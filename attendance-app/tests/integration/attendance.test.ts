import { createHash, createHmac } from "node:crypto";

import type { Session } from "next-auth";
import postgres from "postgres";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeSession = vi.hoisted(() => ({ current: null as Session | null }));

vi.mock("../../lib/auth/session", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("../../lib/auth/session")
  >();

  return {
    ...original,
    getCurrentSession: async () => routeSession.current,
  };
});

import {
  bootstrapProfessor,
  databaseBootstrapRepository,
} from "../../app/api/admin/bootstrap/route";
import { POST as checkInRoute } from "../../app/api/check-in/route";
import { POST as classSessionCreateRoute } from "../../app/api/class-sessions/route";
import { POST as challengeRoute } from "../../app/api/class-sessions/[id]/challenge/route";
import { GET as liveRoute } from "../../app/api/class-sessions/[id]/live/route";
import { POST as manualRecordRoute } from "../../app/api/class-sessions/[id]/records/route";
import { PATCH as classSessionStateRoute } from "../../app/api/class-sessions/[id]/state/route";
import { PATCH as correctRecordRoute } from "../../app/api/records/[id]/route";
import { POST as activateRoute } from "../../app/api/roster/activate/route";
import { POST as rosterImportRoute } from "../../app/api/roster/import/route";
import { GET as semesterExportRoute } from "../../app/api/semesters/[id]/export/route";
import { PATCH as semesterStateRoute } from "../../app/api/semesters/[id]/state/route";
import { POST as semesterCreateRoute } from "../../app/api/semesters/route";
import {
  AttendanceServiceError,
  attendanceService,
  firstForwardedIp,
} from "../../lib/attendance/service";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for attendance integration tests");
}

const sql = postgres(databaseUrl, { max: 20 });
const professor = sessionFor("100", "professor");
const studentA = sessionFor("200", "student-a");
const studentB = sessionFor("300", "student-b");
const studentC = sessionFor("400", "student-c");

function sessionFor(githubId: string, githubLogin: string): Session {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: { githubId, githubLogin },
  };
}

async function seedUsers() {
  await sql`
    insert into users (github_id, github_username, name)
    values
      ('100', 'professor', 'Professor Test'),
      ('200', 'student-a', 'Student A'),
      ('300', 'student-b', 'Student B'),
      ('400', 'student-c', 'Student C')
  `;
  await sql`
    insert into staff (user_id, role, added_by)
    select id, 'professor', id from users where github_id = '100'
  `;
}

async function createActiveSemester(title = "Fall 2026") {
  const semester = await attendanceService.createSemester(professor, {
    title,
    weekCount: 15,
  });
  await attendanceService.transitionSemester(professor, semester.id, {
    state: "active",
    reason: "Teaching starts",
  });
  return semester;
}

async function importAndActivate(
  semesterId: string,
  session: Session,
  studentId: string,
  fullName: string,
  groupName: string,
  ip = "198.51.100.10",
) {
  const [entry] = await attendanceService.importRoster(professor, {
    semesterId,
    rows: [{ studentId, fullName, groupName }],
  });
  const [firstName, ...lastName] = fullName.split(" ");
  await attendanceService.activateRoster(
    session,
    {
      semesterId,
      studentId,
      firstName,
      lastName: lastName.join(" "),
    },
    ip,
  );
  return entry;
}

async function createOpenSession(
  semesterId: string,
  groupName = "G1",
) {
  const classSession = await attendanceService.createClassSession(professor, {
    semesterId,
    weekNumber: 1,
    kind: "lecture",
    groupName,
    title: "Lecture 1",
  });
  return attendanceService.transitionClassSession(
    professor,
    classSession.id,
    { state: "open", reason: "Class started" },
  );
}

function jsonRequest(
  url: string,
  body: unknown,
  ipAddress: string,
  method = "POST",
): Request {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `${ipAddress}, 10.0.0.1`,
    },
    body: JSON.stringify(body),
  });
}

async function waitForAdvisoryWaiters(
  expected: number,
  timeoutMilliseconds = 2_000,
): Promise<"blocked"> {
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    const [row] = await sql`
      select count(*)::integer as count
      from pg_locks
      where locktype = 'advisory' and not granted
    `;
    if (Number(row.count) >= expected) {
      return "blocked";
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Timed out waiting for ${expected} advisory lock waiter(s)`);
}

async function observeAdvisoryWaiters(
  expected: number,
  timeoutMilliseconds = 100,
): Promise<"blocked" | "not-blocked"> {
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    const [row] = await sql`
      select count(*)::integer as count
      from pg_locks
      where locktype = 'advisory' and not granted
    `;
    if (Number(row.count) >= expected) {
      return "blocked";
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  return "not-blocked";
}

async function rateLimitEvidence(
  action: "activation" | "scan" | "challenge" | "live",
  keyMaterial: string,
  windowSeconds: number,
) {
  const expectedHash = createHmac(
    "sha256",
    "integration-rate-limit-secret",
  )
    .update(keyMaterial)
    .digest("hex");
  const [row] = await sql`
    select
      action,
      encode(key_hash, 'hex') as key_hash,
      count,
      greatest(
        1,
        ceil(extract(epoch from (
          window_start + make_interval(secs => ${windowSeconds}) - updated_at
        )))::integer
      ) as retry_after
    from request_limits
    where action = ${action} and key_hash = decode(${expectedHash}, 'hex')
  `;

  return row as {
    action: string;
    key_hash: string;
    count: number;
    retry_after: number;
  };
}

function errorChainMessages(error: unknown): string[] {
  const messages: string[] = [];
  let current = error;

  while (current instanceof Error) {
    messages.push(current.message);
    current = (current as Error & { cause?: unknown }).cause;
  }

  return messages;
}

async function expectHttpRateLimit(
  response: Response | undefined,
  retryAfter: number,
): Promise<void> {
  expect(response).toBeDefined();
  if (!response) {
    throw new Error("Expected an HTTP rate-limit response");
  }
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe(String(retryAfter));
  expect(await response.json()).toEqual({
    error: { code: "rate_limited", message: "Too many requests" },
  });
}

beforeAll(async () => {
  await sql`select 1`;
});

beforeEach(async () => {
  routeSession.current = professor;
  await sql`
    truncate table
      audit_log,
      attendance_records,
      qr_challenges,
      request_limits,
      class_sessions,
      roster,
      semesters,
      bootstrap_state,
      staff,
      users
    restart identity cascade
  `;
  await seedUsers();
});

describe("HTTP route contracts", () => {
  it("returns a generic 400 response for malformed JSON before authentication", async () => {
    const response = await activateRoute(
      new Request("http://attendance.test/api/roster/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "invalid_request", message: "Invalid request" },
    });
  });

  it("enforces every exact rate limit at the HTTP boundary with DB-derived retry headers and per-session keys", async () => {
    const semester = await createActiveSemester();
    await attendanceService.importRoster(professor, {
      semesterId: semester.id,
      rows: [{ studentId: "A-1", fullName: "Arta Kola", groupName: "G1" }],
    });

    const activationIp = "203.0.113.4";
    const request = new Request("http://attendance.test", {
      headers: { "x-forwarded-for": `${activationIp}, 10.0.0.1` },
    });
    expect(firstForwardedIp(request)).toBe(activationIp);
    routeSession.current = studentA;
    const activationResponses = await Promise.all(
      Array.from({ length: 6 }, () =>
        activateRoute(
          jsonRequest(
            "http://attendance.test/api/roster/activate",
            {
              semesterId: semester.id,
              studentId: "A-1",
              firstName: "Arta",
              lastName: "Kola",
            },
            activationIp,
          ),
        ),
      ),
    );
    expect(activationResponses.filter(({ status }) => status === 200)).toHaveLength(5);
    const activationLimited = activationResponses.find(
      ({ status }) => status === 429,
    );
    expect(activationLimited).toBeDefined();
    const activationEvidence = await rateLimitEvidence(
      "activation",
      `200|${activationIp}`,
      600,
    );
    expect(activationEvidence).toMatchObject({ count: 6 });
    await expectHttpRateLimit(
      activationLimited,
      activationEvidence.retry_after,
    );
    expect(activationEvidence.retry_after).toBeGreaterThan(0);

    routeSession.current = professor;
    const firstSession = await createOpenSession(semester.id);
    const secondSession = await createOpenSession(semester.id);
    const challengeIp = "203.0.113.5";
    const challengeResponses = await Promise.all(
      Array.from({ length: 11 }, () =>
        challengeRoute(
          jsonRequest(
            `http://attendance.test/api/class-sessions/${firstSession.id}/challenge`,
            {},
            challengeIp,
          ),
          { params: Promise.resolve({ id: firstSession.id }) },
        ),
      ),
    );
    expect(challengeResponses.filter(({ status }) => status === 201)).toHaveLength(10);
    const challengeLimited = challengeResponses.find(
      ({ status }) => status === 429,
    );
    expect(challengeLimited).toBeDefined();
    const challengeEvidence = await rateLimitEvidence(
      "challenge",
      `100|${challengeIp}|${firstSession.id}`,
      60,
    );
    expect(challengeEvidence).toMatchObject({ count: 11 });
    await expectHttpRateLimit(
      challengeLimited,
      challengeEvidence.retry_after,
    );
    expect(challengeEvidence.retry_after).toBeGreaterThan(0);

    const secondChallengeResponse = await challengeRoute(
      jsonRequest(
        `http://attendance.test/api/class-sessions/${secondSession.id}/challenge`,
        {},
        challengeIp,
      ),
      { params: Promise.resolve({ id: secondSession.id }) },
    );
    expect(secondChallengeResponse.status).toBe(201);
    expect(
      await rateLimitEvidence(
        "challenge",
        `100|${challengeIp}|${secondSession.id}`,
        60,
      ),
    ).toMatchObject({ count: 1 });

    const activeChallenge = await sql`
      select encode(token_hash, 'hex') as token_hash
      from qr_challenges where session_id = ${firstSession.id}
    `;
    const challengeBodies = await Promise.all(
      challengeResponses
        .filter(({ status }) => status === 201)
        .map((response) => response.json() as Promise<{ token: string }>),
    );
    const token = challengeBodies.find(
      ({ token: candidate }) =>
        createHash("sha256").update(candidate).digest("hex") ===
        activeChallenge[0].token_hash,
    )?.token;
    expect(token).toBeTruthy();

    routeSession.current = studentA;
    const scanIp = "203.0.113.6";
    const scanResponses = await Promise.all(
      Array.from({ length: 11 }, () =>
        checkInRoute(
          jsonRequest(
            "http://attendance.test/api/check-in",
            { token },
            scanIp,
          ),
        ),
      ),
    );
    expect(scanResponses.filter(({ status }) => status === 200)).toHaveLength(10);
    const scanLimited = scanResponses.find(({ status }) => status === 429);
    expect(scanLimited).toBeDefined();
    const scanEvidence = await rateLimitEvidence(
      "scan",
      `200|${scanIp}`,
      60,
    );
    expect(scanEvidence).toMatchObject({ count: 11 });
    await expectHttpRateLimit(
      scanLimited,
      scanEvidence.retry_after,
    );
    expect(scanEvidence.retry_after).toBeGreaterThan(0);

    routeSession.current = professor;
    const liveIp = "203.0.113.7";
    const liveResponses = await Promise.all(
      Array.from({ length: 91 }, () =>
        liveRoute(
          new Request(
            `http://attendance.test/api/class-sessions/${firstSession.id}/live`,
            { headers: { "x-forwarded-for": `${liveIp}, 10.0.0.1` } },
          ),
          { params: Promise.resolve({ id: firstSession.id }) },
        ),
      ),
    );
    expect(liveResponses.filter(({ status }) => status === 200)).toHaveLength(90);
    const liveLimited = liveResponses.find(({ status }) => status === 429);
    expect(liveLimited).toBeDefined();
    const liveEvidence = await rateLimitEvidence(
      "live",
      `100|${liveIp}|${firstSession.id}`,
      60,
    );
    expect(liveEvidence).toMatchObject({ count: 91 });
    await expectHttpRateLimit(
      liveLimited,
      liveEvidence.retry_after,
    );
    expect(liveEvidence.retry_after).toBeGreaterThan(0);

    const secondLiveResponse = await liveRoute(
      new Request(
        `http://attendance.test/api/class-sessions/${secondSession.id}/live`,
        { headers: { "x-forwarded-for": `${liveIp}, 10.0.0.1` } },
      ),
      { params: Promise.resolve({ id: secondSession.id }) },
    );
    expect(secondLiveResponse.status).toBe(200);
    expect(
      await rateLimitEvidence(
        "live",
        `100|${liveIp}|${secondSession.id}`,
        60,
      ),
    ).toMatchObject({ count: 1 });

    const persistedLimits = await sql`
      select action, encode(key_hash, 'hex') as key_hash from request_limits
    `;
    const persistedText = JSON.stringify(persistedLimits);
    for (const rawIp of [activationIp, challengeIp, scanIp, liveIp]) {
      expect(persistedText).not.toContain(rawIp);
    }
  });
});

describe("protected semester and roster management", () => {
  it("denies nonstaff mutations, exposes only active semesters to students, and audits explicit state transitions", async () => {
    await expect(
      attendanceService.createSemester(studentA, {
        title: "Forbidden",
        weekCount: 15,
      }),
    ).rejects.toMatchObject({ status: 403 });

    const draft = await attendanceService.createSemester(professor, {
      title: "Fall 2026",
      weekCount: 15,
    });
    const otherDraft = await attendanceService.createSemester(professor, {
      title: "Spring 2027",
      weekCount: 15,
    });
    await attendanceService.transitionSemester(professor, draft.id, {
      state: "active",
      reason: "Published",
    });

    expect(await attendanceService.listSemesters(studentA)).toEqual([
      expect.objectContaining({ id: draft.id, status: "active" }),
    ]);
    expect(await attendanceService.listSemesters(professor)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: draft.id, status: "active" }),
        expect.objectContaining({ id: otherDraft.id, status: "draft" }),
      ]),
    );

    await expect(
      attendanceService.transitionSemester(professor, draft.id, {
        state: "draft",
        reason: "Invalid rollback",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await attendanceService.transitionSemester(professor, draft.id, {
      state: "archived",
      reason: "Term finished",
    });
    expect(await attendanceService.listSemesters(studentA)).toEqual([]);

    const audit = await sql`
      select action, reason from audit_log
      where subject_id = ${draft.id}
      order by created_at
    `;
    expect(audit).toEqual([
      expect.objectContaining({ action: "semester.create" }),
      { action: "semester.state", reason: "Published" },
      { action: "semester.state", reason: "Term finished" },
    ]);
  });

  it("activates one matching roster row atomically and returns the same generic mismatch for every failed match", async () => {
    const semester = await createActiveSemester();
    await attendanceService.importRoster(professor, {
      semesterId: semester.id,
      rows: [
        { studentId: "A-1", fullName: "Ëndrra Çela", groupName: "G1" },
      ],
    });

    const attempts = await Promise.allSettled([
      attendanceService.activateRoster(
        studentA,
        {
          semesterId: semester.id,
          studentId: "A-1",
          firstName: "  ËNDRRA ",
          lastName: " ÇELA ",
        },
        "198.51.100.11",
      ),
      attendanceService.activateRoster(
        studentB,
        {
          semesterId: semester.id,
          studentId: "A-1",
          firstName: "Ëndrra",
          lastName: "Çela",
        },
        "198.51.100.12",
      ),
    ]);
    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const wrongId = attendanceService.activateRoster(
      studentC,
      {
        semesterId: semester.id,
        studentId: "missing",
        firstName: "Ëndrra",
        lastName: "Çela",
      },
      "198.51.100.13",
    );
    const wrongName = attendanceService.activateRoster(
      studentC,
      {
        semesterId: semester.id,
        studentId: "A-1",
        firstName: "Wrong",
        lastName: "Name",
      },
      "198.51.100.14",
    );
    const [wrongIdError, wrongNameError] = await Promise.all([
      wrongId.catch((error: unknown) => error),
      wrongName.catch((error: unknown) => error),
    ]);
    expect(wrongIdError).toMatchObject({
      code: "roster_mismatch",
      message: "The supplied details do not match an available roster entry",
    });
    expect(wrongNameError).toMatchObject({
      code: "roster_mismatch",
      message: "The supplied details do not match an available roster entry",
    });
  });

  it("denies every protected management operation to nonstaff and immediately revoked staff", async () => {
    const semester = await createActiveSemester();
    const [recordedRoster, emptyRoster] = await attendanceService.importRoster(
      professor,
      {
        semesterId: semester.id,
        rows: [
          { studentId: "A-1", fullName: "Arta Kola", groupName: "G1" },
          { studentId: "B-1", fullName: "Besa Dema", groupName: "G1" },
        ],
      },
    );
    const classSession = await createOpenSession(semester.id);
    const record = await attendanceService.createManualRecord(
      professor,
      classSession.id,
      {
        rosterId: recordedRoster.id,
        status: "present",
        reason: "Initial evidence",
      },
    );

    const operations: Array<[string, () => Promise<Response>]> = [
      [
        "semester creation",
        () =>
          semesterCreateRoute(
            jsonRequest(
              "http://attendance.test/api/semesters",
              { title: "Denied semester", weekCount: 15 },
              "198.51.100.80",
            ),
          ),
      ],
      [
        "class session creation",
        () =>
          classSessionCreateRoute(
            jsonRequest(
              "http://attendance.test/api/class-sessions",
              {
                semesterId: semester.id,
                weekNumber: 2,
                kind: "lecture",
                groupName: "G1",
                title: "Denied class session",
              },
              "198.51.100.80",
            ),
          ),
      ],
      [
        "roster import",
        () =>
          rosterImportRoute(
            jsonRequest(
              "http://attendance.test/api/roster/import",
              {
                semesterId: semester.id,
                rows: [
                  {
                    studentId: "DENIED",
                    fullName: "Denied User",
                    groupName: "G1",
                  },
                ],
              },
              "198.51.100.80",
            ),
          ),
      ],
      [
        "challenge rotation",
        () =>
          challengeRoute(
            jsonRequest(
              `http://attendance.test/api/class-sessions/${classSession.id}/challenge`,
              {},
              "198.51.100.80",
            ),
            { params: Promise.resolve({ id: classSession.id }) },
          ),
      ],
      [
        "live attendance",
        () =>
          liveRoute(
            new Request(
              `http://attendance.test/api/class-sessions/${classSession.id}/live`,
              { headers: { "x-forwarded-for": "198.51.100.80" } },
            ),
            { params: Promise.resolve({ id: classSession.id }) },
          ),
      ],
      [
        "class session state",
        () =>
          classSessionStateRoute(
            jsonRequest(
              `http://attendance.test/api/class-sessions/${classSession.id}/state`,
              { state: "closed", reason: "Denied close" },
              "198.51.100.80",
              "PATCH",
            ),
            { params: Promise.resolve({ id: classSession.id }) },
          ),
      ],
      [
        "semester state",
        () =>
          semesterStateRoute(
            jsonRequest(
              `http://attendance.test/api/semesters/${semester.id}/state`,
              { state: "archived", reason: "Denied archive" },
              "198.51.100.80",
              "PATCH",
            ),
            { params: Promise.resolve({ id: semester.id }) },
          ),
      ],
      [
        "manual record",
        () =>
          manualRecordRoute(
            jsonRequest(
              `http://attendance.test/api/class-sessions/${classSession.id}/records`,
              {
                rosterId: emptyRoster.id,
                status: "excused",
                reason: "Denied manual entry",
              },
              "198.51.100.80",
            ),
            { params: Promise.resolve({ id: classSession.id }) },
          ),
      ],
      [
        "record correction",
        () =>
          correctRecordRoute(
            jsonRequest(
              `http://attendance.test/api/records/${record.id}`,
              { status: "rejected", reason: "Denied correction" },
              "198.51.100.80",
              "PATCH",
            ),
            { params: Promise.resolve({ id: record.id }) },
          ),
      ],
      [
        "CSV export",
        () =>
          semesterExportRoute(
            new Request(
              `http://attendance.test/api/semesters/${semester.id}/export`,
            ),
            { params: Promise.resolve({ id: semester.id }) },
          ),
      ],
    ];

    routeSession.current = studentA;
    for (const [label, operation] of operations) {
      const response = await operation();
      expect(response.status, `${label} must deny nonstaff`).toBe(403);
      expect(await response.json()).toEqual({
        error: {
          code: "staff_required",
          message: "Staff access required",
        },
      });
    }

    await sql`delete from staff`;

    routeSession.current = professor;
    for (const [label, operation] of operations) {
      const response = await operation();
      expect(
        response.status,
        `${label} must recheck a revoked staff membership`,
      ).toBe(403);
      expect(await response.json()).toEqual({
        error: {
          code: "staff_required",
          message: "Staff access required",
        },
      });
    }
  });
});

describe("PostgreSQL rate limiting", () => {
  it("atomically enforces the activation boundary, returns a database-derived retry, stores only HMAC keys, and cleans old windows", async () => {
    const semester = await createActiveSemester();
    await attendanceService.importRoster(professor, {
      semesterId: semester.id,
      rows: [{ studentId: "A-1", fullName: "Arta Kola", groupName: "G1" }],
    });
    const input = {
      semesterId: semester.id,
      studentId: "A-1",
      firstName: "Arta",
      lastName: "Kola",
    };
    const ip = "203.0.113.77";
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        attendanceService.activateRoster(studentA, input, ip),
      ),
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(AttendanceServiceError);
    expect(rejected[0].reason).toMatchObject({
      status: 429,
      code: "rate_limited",
    });
    expect(rejected[0].reason.retryAfter).toBeGreaterThan(0);
    expect(rejected[0].reason.retryAfter).toBeLessThanOrEqual(600);

    const expectedHash = createHmac(
      "sha256",
      "integration-rate-limit-secret",
    )
      .update(`200|${ip}`)
      .digest("hex");
    const limits = await sql`
      select encode(key_hash, 'hex') as key_hash, count
      from request_limits where action = 'activation'
    `;
    expect(limits).toEqual([{ key_hash: expectedHash, count: 6 }]);
    expect(JSON.stringify(limits)).not.toContain(ip);

    await sql`
      insert into request_limits (action, key_hash, window_start, count)
      values ('stale', ${Buffer.alloc(32)}, now() - interval '25 hours', 1)
    `;
    await attendanceService.createSemester(professor, {
      title: "Cleanup trigger",
      weekCount: 1,
    });
    expect(await sql`select 1 from request_limits where action = 'stale'`).toHaveLength(0);
  });

  it("enforces the exact concurrent challenge, scan, and live limits per user, IP, and session", async () => {
    const semester = await createActiveSemester();
    await importAndActivate(
      semester.id,
      studentA,
      "A-1",
      "Arta Kola",
      "G1",
    );
    const classSession = await createOpenSession(semester.id);
    const staffIp = "198.51.100.40";
    const challengeResults = await Promise.all(
      Array.from({ length: 10 }, () =>
        attendanceService.createChallenge(professor, classSession.id, staffIp),
      ),
    );
    await expect(
      attendanceService.createChallenge(professor, classSession.id, staffIp),
    ).rejects.toMatchObject({ status: 429, retryAfter: expect.any(Number) });
    const activeChallenges = await sql`
      select encode(token_hash, 'hex') as token_hash from qr_challenges
      where session_id = ${classSession.id}
    `;
    expect(activeChallenges).toHaveLength(1);
    const token = challengeResults.find(
      ({ token: candidate }) =>
        createHash("sha256").update(candidate).digest("hex") ===
        activeChallenges[0].token_hash,
    )?.token;
    expect(token).toBeTruthy();
    expect(activeChallenges[0].token_hash).toBe(
      createHash("sha256").update(token ?? "").digest("hex"),
    );

    const scanIp = "198.51.100.41";
    const scans = await Promise.all(
      Array.from({ length: 10 }, () =>
        attendanceService.checkIn(studentA, { token: token ?? "" }, scanIp),
      ),
    );
    expect(scans.filter(({ duplicate }) => !duplicate)).toHaveLength(1);
    expect(await sql`select 1 from attendance_records`).toHaveLength(1);
    await expect(
      attendanceService.checkIn(studentA, { token: token ?? "" }, scanIp),
    ).rejects.toMatchObject({ status: 429 });

    const snapshots = await Promise.all(
      Array.from({ length: 90 }, () =>
        attendanceService.getLiveSession(professor, classSession.id, staffIp),
      ),
    );
    expect(snapshots).toHaveLength(90);
    await expect(
      attendanceService.getLiveSession(professor, classSession.id, staffIp),
    ).rejects.toMatchObject({ status: 429 });
  });
});

describe("challenge acceptance and live attendance", () => {
  it("rotates 40-second challenges, rejects expiry, cross-group use and the database-clock two-minute cutoff", async () => {
    const semester = await createActiveSemester();
    await importAndActivate(semester.id, studentA, "A-1", "Arta Kola", "G1");
    await importAndActivate(semester.id, studentB, "B-1", "Besa Dema", "G2");
    const classSession = await createOpenSession(semester.id, "G1");
    const first = await attendanceService.createChallenge(
      professor,
      classSession.id,
      "192.0.2.1",
    );
    const second = await attendanceService.createChallenge(
      professor,
      classSession.id,
      "192.0.2.1",
    );
    expect(second.token).not.toBe(first.token);
    expect(new Date(second.expiresAt).getTime() - new Date(second.serverTime).getTime()).toBe(
      40_000,
    );
    await expect(
      attendanceService.checkIn(studentA, { token: first.token }, "192.0.2.2"),
    ).rejects.toMatchObject({ code: "invalid_challenge" });
    await expect(
      attendanceService.checkIn(studentB, { token: second.token }, "192.0.2.3"),
    ).rejects.toMatchObject({ code: "wrong_group" });

    await sql`
      update qr_challenges set expires_at = now() - interval '1 second'
      where session_id = ${classSession.id}
    `;
    await expect(
      attendanceService.checkIn(studentA, { token: second.token }, "192.0.2.4"),
    ).rejects.toMatchObject({ code: "invalid_challenge" });

    const third = await attendanceService.createChallenge(
      professor,
      classSession.id,
      "192.0.2.5",
    );
    await sql`
      update class_sessions set checkin_ends_at = now() - interval '1 second'
      where id = ${classSession.id}
    `;
    await expect(
      attendanceService.checkIn(studentA, { token: third.token }, "192.0.2.6"),
    ).rejects.toMatchObject({ code: "checkin_closed" });
  });

  it("queues a scan behind challenge rotation and rejects the token removed by the winning rotation", async () => {
    const semester = await createActiveSemester();
    await importAndActivate(semester.id, studentA, "A-1", "Arta Kola", "G1");
    const classSession = await createOpenSession(semester.id);
    const original = await attendanceService.createChallenge(
      professor,
      classSession.id,
      "192.0.2.20",
    );
    let rotationPromise:
      | ReturnType<typeof attendanceService.createChallenge>
      | undefined;
    let scanPromise: ReturnType<typeof attendanceService.checkIn> | undefined;
    let observedWhileLocked: "blocked" | "settled" | undefined;

    await sql.begin(async (holder) => {
      await holder`
        select pg_advisory_xact_lock(hashtextextended(${classSession.id}, 0))
      `;
      rotationPromise = attendanceService.createChallenge(
        professor,
        classSession.id,
        "192.0.2.21",
      );
      await waitForAdvisoryWaiters(1);
      scanPromise = attendanceService.checkIn(
        studentA,
        { token: original.token },
        "192.0.2.22",
      );
      observedWhileLocked = await Promise.race([
        waitForAdvisoryWaiters(2),
        scanPromise.then(
          () => "settled" as const,
          () => "settled" as const,
        ),
      ]);
    });

    if (!rotationPromise || !scanPromise) {
      throw new Error("Concurrent operations were not started");
    }
    const [rotated, scanOutcome] = await Promise.all([
      rotationPromise,
      scanPromise.then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ),
    ]);
    expect(observedWhileLocked).toBe("blocked");
    expect(rotated.token).not.toBe(original.token);
    expect(scanOutcome).toMatchObject({
      status: "rejected",
      reason: { code: "invalid_challenge" },
    });
    expect(await sql`select 1 from attendance_records`).toHaveLength(0);
  });

  it.each([
    ["challenge", "invalid_challenge"],
    ["session", "checkin_closed"],
  ] as const)(
    "rechecks the %s deadline after waiting for the synchronization lock",
    async (boundary, expectedCode) => {
      const semester = await createActiveSemester();
      await importAndActivate(
        semester.id,
        studentA,
        "A-1",
        "Arta Kola",
        "G1",
      );
      const classSession = await createOpenSession(semester.id);
      const challenge = await attendanceService.createChallenge(
        professor,
        classSession.id,
        `192.0.2.${boundary === "challenge" ? "30" : "31"}`,
      );
      let scanPromise: ReturnType<typeof attendanceService.checkIn> | undefined;
      let observedWhileLocked:
        | "blocked"
        | "not-blocked"
        | "settled"
        | undefined;

      await sql.begin(async (holder) => {
        await holder`
          select pg_advisory_xact_lock(hashtextextended(${classSession.id}, 0))
        `;
        if (boundary === "challenge") {
          await holder`
            update qr_challenges
            set expires_at = clock_timestamp() + interval '150 milliseconds'
            where session_id = ${classSession.id}
          `;
        } else {
          await holder`
            update qr_challenges
            set expires_at = clock_timestamp() + interval '1 minute'
            where session_id = ${classSession.id}
          `;
          await holder`
            update class_sessions
            set checkin_ends_at = clock_timestamp() + interval '150 milliseconds'
            where id = ${classSession.id}
          `;
        }
        scanPromise = attendanceService.checkIn(
          studentA,
          { token: challenge.token },
          `192.0.2.${boundary === "challenge" ? "32" : "33"}`,
        );
        observedWhileLocked = await Promise.race([
          observeAdvisoryWaiters(1),
          scanPromise.then(
            () => "settled" as const,
            () => "settled" as const,
          ),
        ]);
        await holder`select pg_sleep(0.25)`;
      });

      if (!scanPromise) {
        throw new Error("Scan was not started");
      }
      const outcome = await scanPromise.then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      );
      expect(observedWhileLocked).toBe("blocked");
      expect(outcome).toMatchObject({
        status: "rejected",
        reason: { code: expectedCode },
      });
      expect(await sql`select 1 from attendance_records`).toHaveLength(0);
    },
  );

  it("returns a masked, stable live order while keeping students isolated", async () => {
    const semester = await createActiveSemester();
    const firstRoster = await importAndActivate(
      semester.id,
      studentA,
      "A-1",
      "Arta Kola",
      "G1",
    );
    const secondRoster = await importAndActivate(
      semester.id,
      studentB,
      "B-1",
      "Besa Dema",
      "G1",
    );
    const classSession = await createOpenSession(semester.id);
    const challenge = await attendanceService.createChallenge(
      professor,
      classSession.id,
      "192.0.2.10",
    );
    await attendanceService.checkIn(studentA, { token: challenge.token }, "192.0.2.11");
    const nextChallenge = await attendanceService.createChallenge(
      professor,
      classSession.id,
      "192.0.2.10",
    );
    await attendanceService.checkIn(studentB, { token: nextChallenge.token }, "192.0.2.12");
    await sql`
      update attendance_records set scanned_at = case roster_id
        when ${firstRoster.id} then timestamp with time zone '2026-09-17 10:00:02+00'
        when ${secondRoster.id} then timestamp with time zone '2026-09-17 10:00:01+00'
      end
    `;

    const snapshot = await attendanceService.getLiveSession(
      professor,
      classSession.id,
      "192.0.2.13",
    );
    expect(snapshot.entries.map(({ rosterId }) => rosterId)).toEqual([
      secondRoster.id,
      firstRoster.id,
    ]);
    expect(snapshot.entries.map(({ displayName }) => displayName)).toEqual([
      "Besa D.",
      "Arta K.",
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("Besa Dema");
    expect(JSON.stringify(snapshot)).not.toContain("B-1");
    expect(JSON.stringify(snapshot)).not.toContain("student-b");
    await expect(
      attendanceService.getLiveSession(studentA, classSession.id, "192.0.2.14"),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("manual records and CSV evidence", () => {
  it("creates attendance for a student without a phone, corrects it with reasons, exports safe CSV, and audits every action", async () => {
    const semester = await createActiveSemester("=Unsafe semester");
    const [phoneLess] = await attendanceService.importRoster(professor, {
      semesterId: semester.id,
      rows: [
        {
          studentId: "+441",
          fullName: "=FORMULA Student",
          groupName: "G1",
        },
      ],
    });
    const classSession = await createOpenSession(semester.id);
    const record = await attendanceService.createManualRecord(
      professor,
      classSession.id,
      {
        rosterId: phoneLess.id,
        status: "present",
        reason: "Student has no phone",
      },
    );
    await attendanceService.correctRecord(professor, record.id, {
      status: "excused",
      reason: "Approved absence",
    });

    const exported = await attendanceService.exportSemester(
      professor,
      semester.id,
    );
    expect(exported.filename).toMatch(/\.csv$/);
    expect(exported.csv).toContain("Student ID,Full Name,Group,Session,Week,Kind,Status,Recorded At,Reason");
    expect(exported.csv).toContain("'+441");
    expect(exported.csv).toContain("'=FORMULA Student");
    expect(exported.csv).toContain("excused");

    const audit = await sql`
      select action, reason from audit_log
      where action in ('attendance.manual', 'attendance.correct', 'semester.export')
      order by created_at
    `;
    expect(audit).toEqual([
      { action: "attendance.manual", reason: "Student has no phone" },
      { action: "attendance.correct", reason: "Approved absence" },
      { action: "semester.export", reason: "CSV export" },
    ]);
  });
});

describe("database-backed professor bootstrap", () => {
  it("rolls back the production adapter marker and role when PostgreSQL rejects its audit write", async () => {
    await sql`delete from staff`;
    await sql`
      create function reject_bootstrap_audit() returns trigger
      language plpgsql as $$
      begin
        raise exception 'injected bootstrap audit failure';
      end
      $$
    `;
    await sql`
      create trigger reject_bootstrap_audit
      before insert on audit_log
      for each row when (new.action = 'staff.bootstrap')
      execute function reject_bootstrap_audit()
    `;

    try {
      const failure = await bootstrapProfessor(
        professor,
        "100",
        databaseBootstrapRepository,
      ).then(
        () => null,
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(Error);
      expect(errorChainMessages(failure)).toContain(
        "injected bootstrap audit failure",
      );
      expect(await sql`select 1 from bootstrap_state`).toHaveLength(0);
      expect(await sql`select 1 from staff`).toHaveLength(0);
    } finally {
      await sql`drop trigger if exists reject_bootstrap_audit on audit_log`;
      await sql`drop function if exists reject_bootstrap_audit()`;
    }
  });

  it("allows exactly one concurrent winner through the production adapter", async () => {
    await sql`delete from staff`;
    const results = await Promise.all([
      bootstrapProfessor(professor, "100", databaseBootstrapRepository),
      bootstrapProfessor(professor, "100", databaseBootstrapRepository),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([
      "already-completed",
      "created",
    ]);
    expect(await sql`select 1 from bootstrap_state`).toHaveLength(1);
    expect(await sql`select 1 from staff`).toHaveLength(1);
    expect(await sql`select 1 from audit_log where action = 'staff.bootstrap'`).toHaveLength(1);
  });
});
