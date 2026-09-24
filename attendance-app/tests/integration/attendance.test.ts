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
import {
  GET as classSessionListRoute,
  POST as classSessionCreateRoute,
} from "../../app/api/class-sessions/route";
import { POST as challengeRoute } from "../../app/api/class-sessions/[id]/challenge/route";
import { GET as liveRoute } from "../../app/api/class-sessions/[id]/live/route";
import {
  GET as sessionRecordsRoute,
  POST as manualRecordRoute,
} from "../../app/api/class-sessions/[id]/records/route";
import { PATCH as classSessionStateRoute } from "../../app/api/class-sessions/[id]/state/route";
import { PATCH as correctRecordRoute } from "../../app/api/records/[id]/route";
import { POST as activateRoute } from "../../app/api/roster/activate/route";
import { POST as rosterImportRoute } from "../../app/api/roster/import/route";
import { GET as studentHistoryRoute } from "../../app/api/student/history/route";
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
      email: `${studentId.toLowerCase()}@example.com`,
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
    error: { code: "rate_limited", message: "Ke provuar disa herë radhazi. Prit pak dhe provo përsëri." },
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

describe("automatic current-course setup", () => {
  it("preserves archived records and idempotently creates the 15-week Thursday schedule", async () => {
    const pilot = await createActiveSemester("[PILOT SYNTHETIC] Programimi Mobile 2026");
    await attendanceService.importRoster(professor, {
      semesterId: pilot.id,
      rows: [{ studentId: "P-1", fullName: "Pilot Student", groupName: "G1" }],
    });
    await attendanceService.transitionSemester(professor, pilot.id, {
      state: "archived",
      reason: "Pilot completed",
    });
    const finalPilot = await createActiveSemester("[PILOT SYNTHETIC FINAL] 1789669554104");
    await attendanceService.transitionSemester(professor, finalPilot.id, {
      state: "archived",
      reason: "Final pilot completed",
    });

    const first = await attendanceService.ensureCurrentCourseSetup(professor);
    expect(first).toMatchObject({ createdSessions: 43, removedPilotSemesters: 0 });

    const [semester] = await sql`
      select id, title, week_count, status
      from semesters
      where title = 'Programimi për Pajisje Mobile · Semestri Dimëror 2026/27'
    `;
    expect(semester).toMatchObject({ week_count: 15, status: "active" });

    const sessions = await sql`
      select week_number, kind, group_name, title
      from class_sessions
      where semester_id = ${semester.id}
      order by week_number, case when kind = 'lecture' then 0 else 1 end, group_name
    `;
    expect(sessions).toHaveLength(43);
    expect(sessions[0]).toMatchObject({
      week_number: 1,
      kind: "lecture",
      group_name: "G1+G2",
    });
    expect(sessions[0].title).toContain("17.09.2026 · 16:30");
    expect(sessions[1]).toMatchObject({ week_number: 2, kind: "lecture" });
    expect(sessions[2]).toMatchObject({ week_number: 2, kind: "lab" });
    expect(sessions.at(-1)?.title).toContain("24.12.2026 · 18:00");

    const second = await attendanceService.ensureCurrentCourseSetup(professor);
    expect(second).toMatchObject({ createdSessions: 0, removedPilotSemesters: 0 });
    expect(await sql`select id from class_sessions where semester_id = ${semester.id}`).toHaveLength(43);
    expect(await sql`select id from semesters where title like '[PILOT SYNTHETIC%'`).toHaveLength(2);
  });

  it("does not reactivate or repopulate the course after the professor archives it", async () => {
    const semester = await createActiveSemester(
      "Programimi për Pajisje Mobile · Semestri Dimëror 2026/27",
    );
    await attendanceService.transitionSemester(professor, semester.id, {
      state: "archived",
      reason: "Semester completed",
    });

    const result = await attendanceService.ensureCurrentCourseSetup(professor);
    expect(result.createdSessions).toBe(0);
    expect(await sql`select id from class_sessions where semester_id = ${semester.id}`).toHaveLength(0);
    const [saved] = await sql`select status from semesters where id = ${semester.id}`;
    expect(saved.status).toBe("archived");
  });
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
              email: "arta@example.com",
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
  it("lists existing class sessions for current staff and rechecks revoked membership", async () => {
    const semester = await createActiveSemester();
    const first = await attendanceService.createClassSession(professor, {
      semesterId: semester.id,
      weekNumber: 1,
      kind: "lecture",
      groupName: "G1",
      title: "Lecture 1",
    });
    await attendanceService.createClassSession(professor, {
      semesterId: semester.id,
      weekNumber: 2,
      kind: "lab",
      groupName: "G1",
      title: "Lab 2",
    });

    const otherSemester = await createActiveSemester("Spring 2027");
    await createOpenSession(otherSemester.id);

    routeSession.current = professor;
    const allSessions = await classSessionListRoute(new Request("http://attendance.test/api/class-sessions"));
    expect(await allSessions.json()).toHaveLength(3);
    const invalid = await classSessionListRoute(new Request("http://attendance.test/api/class-sessions?semesterId=invalid"));
    expect(invalid.status).toBe(400);
    const allowed = await classSessionListRoute(new Request(
      `http://attendance.test/api/class-sessions?semesterId=${semester.id}`,
    ));
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual([
      expect.objectContaining({
        id: first.id,
        semesterId: semester.id,
        semesterTitle: "Fall 2026",
        title: "Lecture 1",
        state: "draft",
      }),
      expect.objectContaining({ title: "Lab 2", state: "draft" }),
    ]);

    routeSession.current = studentA;
    const denied = await classSessionListRoute(
      new Request("http://attendance.test/api/class-sessions"),
    );
    expect(denied.status).toBe(403);
    routeSession.current = null;
    const anonymous = await classSessionListRoute(new Request("http://attendance.test/api/class-sessions"));
    expect(anonymous.status).toBe(401);

    await sql`delete from staff`;
    routeSession.current = professor;
    const revoked = await classSessionListRoute(
      new Request("http://attendance.test/api/class-sessions"),
    );
    expect(revoked.status).toBe(403);
  });

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
          message: "Kjo hapësirë është vetëm për profesorin.",
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
          message: "Kjo hapësirë është vetëm për profesorin.",
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
    expect(activeChallenges).toHaveLength(10);
    const token = challengeResults[0].token;
    expect(activeChallenges.map(({ token_hash }) => token_hash)).toContain(
      createHash("sha256").update(token).digest("hex"),
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
  it("finalizes an expired session once across concurrent server reads and rejects every late action", async () => {
    const semester = await createActiveSemester();
    await importAndActivate(semester.id, studentA, "A-1", "Arta Kola", "G1");
    const classSession = await createOpenSession(semester.id);
    const challenge = await attendanceService.createChallenge(
      professor,
      classSession.id,
      "192.0.2.90",
    );
    await sql`
      update class_sessions
      set checkin_ends_at = statement_timestamp() - interval '1 second'
      where id = ${classSession.id}
    `;

    const [live, records, sessions, lateChallenge, lateScan] =
      await Promise.all([
        attendanceService.getLiveSession(
          professor,
          classSession.id,
          "192.0.2.91",
        ),
        attendanceService.getSessionRecords(professor, classSession.id),
        attendanceService.listClassSessions(professor, semester.id),
        attendanceService
          .createChallenge(professor, classSession.id, "192.0.2.92")
          .then(
            () => ({ status: "fulfilled" as const }),
            (reason: unknown) => ({ status: "rejected" as const, reason }),
          ),
        attendanceService
          .checkIn(studentA, { token: challenge.token }, "192.0.2.93")
          .then(
            () => ({ status: "fulfilled" as const }),
            (reason: unknown) => ({ status: "rejected" as const, reason }),
          ),
      ]);

    expect(live.state).toBe("closed");
    expect(records.session.state).toBe("closed");
    expect(sessions).toEqual([
      expect.objectContaining({ id: classSession.id, state: "closed" }),
    ]);
    expect(lateChallenge).toMatchObject({
      status: "rejected",
      reason: { code: "checkin_closed" },
    });
    expect(lateScan).toMatchObject({
      status: "rejected",
      reason: { code: "checkin_closed" },
    });

    const [persisted] = await sql`
      select state, created_by as "createdBy"
      from class_sessions
      where id = ${classSession.id}
    `;
    expect(persisted.state).toBe("closed");

    const automaticAudits = await sql`
      select
        actor_user_id as "actorUserId",
        action,
        reason,
        metadata
      from audit_log
      where subject_id = ${classSession.id}
        and metadata ->> 'actorKind' = 'system'
    `;
    expect(automaticAudits).toEqual([
      expect.objectContaining({
        actorUserId: persisted.createdBy,
        action: "class_session.state",
        reason: "Automatic closure at the server check-in deadline",
        metadata: expect.objectContaining({
          actorKind: "system",
          actorAttribution: "session_creator",
          policy: "checkin_deadline",
          from: "open",
          to: "closed",
        }),
      }),
    ]);

    const repeated = await attendanceService.getLiveSession(
      professor,
      classSession.id,
      "192.0.2.94",
    );
    expect(repeated.state).toBe("closed");
    expect(await sql`
      select 1
      from audit_log
      where subject_id = ${classSession.id}
        and metadata ->> 'actorKind' = 'system'
    `).toHaveLength(1);
  });

  it("keeps QR tokens valid during the session, rejects expiry and cross-group use at the database deadline", async () => {
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
    expect(new Date(second.expiresAt).getTime() - new Date(second.serverTime).getTime()).toBeGreaterThan(0);
    await expect(
      attendanceService.checkIn(studentA, { token: first.token }, "192.0.2.2"),
    ).resolves.toMatchObject({ status: "present" });
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

  it("queues a scan behind a second QR issue and still accepts the first valid token", async () => {
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
      status: "fulfilled",
      value: { status: "present" },
    });
    expect(await sql`select 1 from attendance_records`).toHaveLength(1);
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

  it("returns full names in stable live order while keeping students isolated", async () => {
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
      "Besa Dema",
      "Arta Kola",
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("B-1");
    expect(JSON.stringify(snapshot)).not.toContain("student-b");
    await expect(
      attendanceService.getLiveSession(studentA, classSession.id, "192.0.2.14"),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("student history", () => {
  it("derives identity from the session and ignores client parameters that name another student", async () => {
    const semester = await createActiveSemester();
    await importAndActivate(semester.id, studentA, "A-1", "Arta Kola", "G1");
    await importAndActivate(semester.id, studentB, "B-1", "Besa Dema", "G1");

    const lecture = await createOpenSession(semester.id);
    const lectureChallenge = await attendanceService.createChallenge(
      professor,
      lecture.id,
      "192.0.2.60",
    );
    await attendanceService.checkIn(
      studentA,
      { token: lectureChallenge.token },
      "192.0.2.61",
    );

    const lab = await attendanceService.createClassSession(professor, {
      semesterId: semester.id,
      weekNumber: 2,
      kind: "lab",
      groupName: "G1",
      title: "Lab 2",
    });
    await attendanceService.transitionClassSession(professor, lab.id, {
      state: "open",
      reason: "Lab started",
    });
    const labChallenge = await attendanceService.createChallenge(
      professor,
      lab.id,
      "192.0.2.62",
    );
    await attendanceService.checkIn(
      studentB,
      { token: labChallenge.token },
      "192.0.2.63",
    );

    routeSession.current = studentA;
    const ordinary = await studentHistoryRoute(
      new Request("http://attendance.test/api/student/history"),
    );
    const attemptedOverride = await studentHistoryRoute(
      new Request(
        "http://attendance.test/api/student/history?githubId=300&userId=student-b",
      ),
    );
    expect(ordinary.status).toBe(200);
    expect(attemptedOverride.status).toBe(200);
    const expected = {
      sessions: expect.arrayContaining([
        expect.objectContaining({
          id: lecture.id,
          kind: "lecture",
          status: "present",
        }),
        expect.objectContaining({
          id: lab.id,
          kind: "lab",
          status: "pending",
        }),
      ]),
      profile: null,
      totals: {
        sessions: 1,
        present: 1,
        excused: 0,
        rejected: 0,
        absent: 0,
        pending: 1,
      },
    };
    const body = await ordinary.json();
    const overriddenBody = await attemptedOverride.json();
    expect(body).toEqual(expected);
    expect(overriddenBody).toEqual(body);
    expect(JSON.stringify(body)).not.toContain("Besa Dema");
    expect(JSON.stringify(body)).not.toContain("B-1");
    expect(JSON.stringify(body)).not.toContain("student-b");
  });
});

describe("manual records and CSV evidence", () => {
  it("reloads a real student check-in after an absent private snapshot and exposes the correction id", async () => {
    const semester = await createActiveSemester();
    const student = await importAndActivate(semester.id, studentA, "A-1", "Arta Kola", "G1");
    const classSession = await createOpenSession(semester.id);
    routeSession.current = professor;
    const read = () => sessionRecordsRoute(
      new Request(`http://attendance.test/api/class-sessions/${classSession.id}/records`),
      { params: Promise.resolve({ id: classSession.id }) },
    );
    expect(await (await read()).json()).toMatchObject({
      records: [{ rosterId: student.id, id: null, status: "absent" }],
    });
    const challenge = await attendanceService.createChallenge(professor, classSession.id, "192.0.2.10");
    const checkedIn = await attendanceService.checkIn(studentA, { token: challenge.token }, "192.0.2.11");
    await expect(attendanceService.createManualRecord(professor, classSession.id, {
      rosterId: student.id, status: "present", reason: "Concurrent staff insert",
    })).rejects.toMatchObject({ status: 409, code: "record_exists" });
    expect(await (await read()).json()).toMatchObject({
      records: [{ rosterId: student.id, id: checkedIn.recordId, status: "present", fullName: "Arta Kola" }],
    });
  });

  it("returns full private session identities only while staff membership is current", async () => {
    const semester = await createActiveSemester();
    const linked = await importAndActivate(
      semester.id,
      studentA,
      "A-1",
      "Arta Kola",
      "G1",
    );
    const [unlinked] = await attendanceService.importRoster(professor, {
      semesterId: semester.id,
      rows: [{ studentId: "B-1", fullName: "Besa Dema", groupName: "G1" }],
    });
    const classSession = await createOpenSession(semester.id);
    await attendanceService.createManualRecord(professor, classSession.id, {
      rosterId: linked.id,
      status: "present",
      reason: "Verified in class",
    });

    routeSession.current = professor;
    const response = await sessionRecordsRoute(
      new Request(
        `http://attendance.test/api/class-sessions/${classSession.id}/records`,
      ),
      { params: Promise.resolve({ id: classSession.id }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      session: { id: classSession.id, title: "Lecture 1", state: "open" },
      records: [
        {
          rosterId: linked.id,
          fullName: "Arta Kola",
          studentId: "A-1",
          githubUsername: "student-a",
          status: "present",
        },
        {
          rosterId: unlinked.id,
          fullName: "Besa Dema",
          studentId: "B-1",
          githubUsername: null,
          status: "absent",
        },
      ],
    });

    routeSession.current = studentA;
    const denied = await sessionRecordsRoute(
      new Request(
        `http://attendance.test/api/class-sessions/${classSession.id}/records`,
      ),
      { params: Promise.resolve({ id: classSession.id }) },
    );
    expect(denied.status).toBe(403);

    await sql`delete from staff`;
    routeSession.current = professor;
    const revoked = await sessionRecordsRoute(
      new Request(
        `http://attendance.test/api/class-sessions/${classSession.id}/records`,
      ),
      { params: Promise.resolve({ id: classSession.id }) },
    );
    expect(revoked.status).toBe(403);
  });

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
    await attendanceService.transitionClassSession(professor, classSession.id, {
      state: "closed",
      reason: "Class completed",
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

  it("exports every student in each closed session group, including absences, and omits unfinished or cancelled sessions", async () => {
    const semester = await createActiveSemester();
    const rosterEntries = await attendanceService.importRoster(professor, {
      semesterId: semester.id,
      rows: [
        { studentId: "A-1", fullName: "Arta Kola", groupName: "G1" },
        { studentId: "B-1", fullName: "Besa Dema", groupName: "G1" },
        { studentId: "C-1", fullName: "Dren Gashi", groupName: "G1" },
        { studentId: "D-1", fullName: "Elira Hoxha", groupName: "G1" },
        { studentId: "E-1", fullName: "Flaka Berisha", groupName: "G2" },
      ],
    });
    const byStudentId = new Map(
      rosterEntries.map((entry) => [entry.studentId, entry]),
    );

    const closedG1 = await createOpenSession(semester.id, "G1");
    await attendanceService.createManualRecord(professor, closedG1.id, {
      rosterId: byStudentId.get("A-1")!.id,
      status: "present",
      reason: "Verified in class",
    });
    await attendanceService.createManualRecord(professor, closedG1.id, {
      rosterId: byStudentId.get("B-1")!.id,
      status: "excused",
      reason: "Approved absence",
    });
    await attendanceService.createManualRecord(professor, closedG1.id, {
      rosterId: byStudentId.get("C-1")!.id,
      status: "rejected",
      reason: "Invalid check-in",
    });
    await attendanceService.transitionClassSession(professor, closedG1.id, {
      state: "closed",
      reason: "Lecture completed",
    });

    const closedG2 = await createOpenSession(semester.id, "G2");
    await attendanceService.transitionClassSession(professor, closedG2.id, {
      state: "closed",
      reason: "Lecture completed",
    });

    const stillOpen = await createOpenSession(semester.id, "G1");
    await attendanceService.createManualRecord(professor, stillOpen.id, {
      rosterId: byStudentId.get("A-1")!.id,
      status: "present",
      reason: "Open session record",
    });

    const cancelled = await createOpenSession(semester.id, "G1");
    await attendanceService.createManualRecord(professor, cancelled.id, {
      rosterId: byStudentId.get("A-1")!.id,
      status: "present",
      reason: "Cancelled session record",
    });
    await attendanceService.transitionClassSession(professor, cancelled.id, {
      state: "cancelled",
      reason: "Class cancelled",
    });

    await attendanceService.createClassSession(professor, {
      semesterId: semester.id,
      weekNumber: 2,
      kind: "lab",
      groupName: "G1",
      title: "Draft lab",
    });

    const exported = await attendanceService.exportSemester(
      professor,
      semester.id,
    );
    const dataRows = exported.csv.trimEnd().split("\r\n").slice(1);
    const selectedColumns = dataRows.map((line) => {
      const columns = line.split(",");
      return {
        studentId: columns[0],
        group: columns[2],
        status: columns[6],
        recordedAt: columns[7],
        reason: columns[8],
      };
    });

    expect(selectedColumns).toEqual([
      {
        studentId: "A-1",
        group: "G1",
        status: "present",
        recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
        reason: "Verified in class",
      },
      {
        studentId: "B-1",
        group: "G1",
        status: "excused",
        recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
        reason: "Approved absence",
      },
      {
        studentId: "C-1",
        group: "G1",
        status: "rejected",
        recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
        reason: "Invalid check-in",
      },
      {
        studentId: "D-1",
        group: "G1",
        status: "absent",
        recordedAt: "",
        reason: "",
      },
      {
        studentId: "E-1",
        group: "G2",
        status: "absent",
        recordedAt: "",
        reason: "",
      },
    ]);
    expect(exported.csv).not.toContain("Open session record");
    expect(exported.csv).not.toContain("Cancelled session record");
    expect(exported.csv).not.toContain("Draft lab");
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


describe("direct course QR launch", () => {
  it("opens exactly the requested lecture and repeated concurrent launches keep the deadline", async () => {
    const [a, b] = await Promise.all([
      attendanceService.launchCourseSession(professor, 2, "lecture"),
      attendanceService.launchCourseSession(professor, 2, "lecture"),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.checkinEndsAt).toEqual(b.checkinEndsAt);
    expect(a.state).toBe("open");
    expect(await sql`select id from class_sessions where state = 'open'`).toHaveLength(1);
    const lab = await attendanceService.launchCourseSession(professor, 2, "lab", "G1");
    expect(lab.id).not.toBe(a.id);
    expect(lab.kind).toBe("lab");
    expect(await sql`select id from audit_log where subject_id = ${a.id} and action = 'class_session.state'`).toHaveLength(1);
  });
  it("rejects students, invalid weeks, finished and archived sessions", async () => {
    await expect(attendanceService.launchCourseSession(studentA, 2, "lecture")).rejects.toMatchObject({ status: 403 });
    await expect(attendanceService.launchCourseSession(null, 2, "lecture")).rejects.toMatchObject({ status: 401 });
    await expect(attendanceService.launchCourseSession(professor, 1, "lab")).rejects.toMatchObject({ status: 400 });
    const opened = await attendanceService.launchCourseSession(professor, 2, "lecture");
    await attendanceService.transitionClassSession(professor, opened.id, { state: "closed", reason: "Test completed" });
    await expect(attendanceService.launchCourseSession(professor, 2, "lecture")).rejects.toMatchObject({ status: 409 });
    await attendanceService.transitionSemester(professor, opened.semesterId, { state: "archived", reason: "Archived" });
    await expect(attendanceService.launchCourseSession(professor, 3, "lecture")).rejects.toMatchObject({ status: 409 });
  });
  it("does not extend an expired window when reopening the same link", async () => {
    const opened = await attendanceService.launchCourseSession(professor, 2, "lecture");
    await sql`update class_sessions set checkin_ends_at = now() - interval '1 second' where id = ${opened.id}`;
    await expect(attendanceService.launchCourseSession(professor, 2, "lecture")).rejects.toMatchObject({ status: 409 });
  });
});


describe("shared lecture and separate lab groups", () => {
  it("accepts both groups in one lecture and keeps lab check-ins, history and exports separate", async () => {
    const { semesterId } = await attendanceService.ensureCurrentCourseSetup(professor);
    await importAndActivate(semesterId, studentA, "A-1", "Arta Kola", "G1");
    await importAndActivate(semesterId, studentB, "B-1", "Besa Duka", "G2");
    const lecture = await attendanceService.launchCourseSession(professor, 2, "lecture");
    const qr = await attendanceService.createChallenge(professor, lecture.id, "192.0.2.1");
    await attendanceService.checkIn(studentA, {token: qr.token}, "192.0.2.2");
    await attendanceService.checkIn(studentB, {token: qr.token}, "192.0.2.3");
    const records = await attendanceService.getSessionRecords(professor, lecture.id);
    expect(records.records).toHaveLength(2);
    expect(records.records.every((row) => row.status === "present")).toBe(true);
    await attendanceService.transitionClassSession(professor, lecture.id, { state: "closed", reason: "Lecture completed" });
    const lab1 = await attendanceService.launchCourseSession(professor, 2, "lab", "G1");
    const lab2 = await attendanceService.launchCourseSession(professor, 2, "lab", "G2");
    expect(lab1.id).not.toBe(lab2.id);
    const labQr = await attendanceService.createChallenge(professor, lab1.id, "192.0.2.1");
    await expect(attendanceService.checkIn(studentB, {token: labQr.token}, "192.0.2.3")).rejects.toMatchObject({code:"wrong_group"});
    await attendanceService.checkIn(studentA, {token: labQr.token}, "192.0.2.2");
    const openReport = await attendanceService.getWeeklyAttendanceReport(professor);
    expect(openReport.rows.filter((row) => row.sessionId === lecture.id).map((row) => row.present)).toEqual(["Po", "Po"]);
    expect(openReport.rows.find((row) => row.sessionId === lab1.id)?.present).toBe("Po");
    expect(openReport.rows.find((row) => row.sessionId === lab2.id)?.present).toBe("Në pritje");
    await attendanceService.transitionClassSession(professor, lab2.id, { state: "closed", reason: "Lab completed" });
    const closedReport = await attendanceService.getWeeklyAttendanceReport(professor);
    expect(closedReport.rows.find((row) => row.sessionId === lab2.id)?.present).toBe("Jo");
    await expect(attendanceService.getWeeklyAttendanceReport(studentA)).rejects.toMatchObject({ status: 403 });
    const history = await attendanceService.getStudentHistory(studentB);
    expect(history.sessions.map((row) => row.id)).toContain(lecture.id);
    expect(history.sessions.map((row) => row.id)).not.toContain(lab1.id);
    expect(history.sessions.map((row) => row.id)).toContain(lab2.id);
    const exported = await attendanceService.exportSemester(professor, semesterId);
    expect(exported.csv).toContain("Arta Kola,G1,");
    expect(exported.csv).toContain("Besa Duka,G2,");
    expect(exported.csv).toContain("Prezent (Po/Jo)");
    await expect(attendanceService.launchCourseSession(professor, 3, "lab")).rejects.toMatchObject({status:400});
  });

  it("does not mark a student absent for a class that ended before enrolment", async () => {
    const { semesterId } = await attendanceService.ensureCurrentCourseSetup(professor);
    const previous = await attendanceService.launchCourseSession(professor, 1, "lecture");
    await attendanceService.transitionClassSession(professor, previous.id, { state: "closed", reason: "Class completed" });
    await importAndActivate(semesterId, studentA, "A-1", "Arta Kola", "G1");
    const current = await attendanceService.launchCourseSession(professor, 2, "lecture");
    const report = await attendanceService.getWeeklyAttendanceReport(professor);
    expect(report.rows.some((row) => row.sessionId === previous.id)).toBe(false);
    expect(report.rows.find((row) => row.sessionId === current.id)?.present).toBe("Në pritje");
    await attendanceService.transitionClassSession(professor, current.id, { state: "closed", reason: "Class completed" });
    const finished = await attendanceService.getWeeklyAttendanceReport(professor);
    expect(finished.rows.find((row) => row.sessionId === current.id)?.present).toBe("Jo");
    expect((await attendanceService.exportSemester(professor, semesterId)).csv).not.toContain(previous.title);
  });

  it("updates draft schedule in place without changing completed records or duplicating the first lecture", async () => {
    const semester = await createActiveSemester("Programimi për Pajisje Mobile · Semestri Dimëror 2026/27");
    const old = await createOpenSession(semester.id, "G1");
    await attendanceService.transitionClassSession(professor, old.id, {state:"closed",reason:"Historical lecture"});
    const draft = await attendanceService.createClassSession(professor,{semesterId:semester.id,weekNumber:2,kind:"lab",groupName:"G1",title:"24.09.2026 · 18:30 · Ushtrime 2"});
    await attendanceService.ensureCurrentCourseSetup(professor);
    await attendanceService.ensureCurrentCourseSetup(professor);
    const [saved] = await sql`select title, group_name, state from class_sessions where id = ${old.id}`;
    expect(saved).toMatchObject({title:old.title,group_name:"G1",state:"closed"});
    const [changed] = await sql`select title from class_sessions where id = ${draft.id}`;
    expect(changed.title).toContain("14:45");
    expect(await sql`select id from class_sessions where semester_id = ${semester.id}`).toHaveLength(43);
    expect(await sql`select id from class_sessions where semester_id = ${semester.id} and week_number=1`).toHaveLength(1);
  });
});

describe("one-time student registration", () => {
  it("enrols from an active QR, preserves profile and supports subsequent check-in", async () => {
    const semester = await createActiveSemester();
    const classSession = await createOpenSession(semester.id, "G1+G2");
    const challenge = await attendanceService.createChallenge(professor, classSession.id, "192.0.2.201");
    const input = { semesterId: semester.id, studentId: "NEW-1", firstName: "Arta", lastName: "Kola", email: "Arta@Example.com", groupName: "G1" as const, token: challenge.token };
    const entry = await attendanceService.activateRoster(studentA, input, "192.0.2.202");
    expect(entry.email).toBe("arta@example.com");
    const again = await attendanceService.activateRoster(studentA, { ...input, email: "different@example.com" }, "192.0.2.202");
    expect(again.id).toBe(entry.id);
    expect(again.email).toBe("arta@example.com");
    expect((await attendanceService.checkIn(studentA, { token: challenge.token }, "192.0.2.202")).duplicate).toBe(false);
    expect((await attendanceService.checkIn(studentA, { token: challenge.token }, "192.0.2.202")).duplicate).toBe(true);
    await expect(attendanceService.activateRoster(studentB, { ...input, studentId: "NEW-2" }, "192.0.2.203")).rejects.toMatchObject({ code: "roster_mismatch" });
    await expect(attendanceService.exportRoster(studentA, semester.id)).rejects.toMatchObject({ code: "staff_required" });
    expect((await attendanceService.exportRoster(professor, semester.id)).csv).toContain("arta@example.com");
  });
  it("allows time to complete registration without extending attendance token validity", async () => {
    const semester = await createActiveSemester();
    const cs = await createOpenSession(semester.id);
    const challenge = await attendanceService.createChallenge(professor, cs.id, "192.0.2.211");
    const error = await attendanceService.checkIn(studentA, { token: challenge.token }, "192.0.2.212").catch(e => e);
    expect(error.code).toBe("roster_not_activated");
    await sql`update qr_challenges set expires_at = statement_timestamp() - interval '1 second' where session_id = ${cs.id}`;
    const input = { semesterId: semester.id, studentId: "NEW-1", firstName: "Arta", lastName: "Kola", email: "arta@example.com", groupName: "G1" as const, registrationPermit: error.registrationPermit };
    await expect(attendanceService.activateRoster(studentB, input, "192.0.2.213")).rejects.toMatchObject({ code: "roster_mismatch" });
    expect((await attendanceService.activateRoster(studentA, input, "192.0.2.212")).email).toBe("arta@example.com");
    await expect(attendanceService.checkIn(studentA, { token: challenge.token }, "192.0.2.212")).rejects.toMatchObject({ code: "invalid_challenge" });
  });
});

it("applies the additive registration migration only through authorized course setup", async () => {
  await sql`alter table roster drop column email`;
  await expect(attendanceService.ensureCurrentCourseSetup(studentA)).rejects.toMatchObject({ code: "staff_required" });
  await attendanceService.ensureCurrentCourseSetup(professor);
  expect((await sql`select column_name from information_schema.columns where table_name='roster' and column_name='email'`)).toHaveLength(1);
});

it("rejects new registration without QR or for another lab group", async () => {
  const semester = await createActiveSemester();
  const cs = await createOpenSession(semester.id, "G1");
  const challenge = await attendanceService.createChallenge(professor, cs.id, "192.0.2.221");
  const input = { semesterId: semester.id, studentId: "N-1", firstName: "Arta", lastName: "Kola", email: "arta@example.com", groupName: "G2" as const };
  await expect(attendanceService.activateRoster(studentA, input, "192.0.2.222")).rejects.toMatchObject({ code: "roster_mismatch" });
  await expect(attendanceService.activateRoster(studentA, { ...input, token: challenge.token }, "192.0.2.222")).rejects.toMatchObject({ code: "registration_qr_expired" });
  expect(await sql`select id from roster`).toHaveLength(0);
});


describe("reset empty test session", () => {
  it("requires staff, invalidates old QR and waits for a deliberate launch", async () => {
    const opened = await attendanceService.launchCourseSession(professor, 2, "lab", "G1");
    await attendanceService.createChallenge(professor, opened.id, "198.51.100.90");
    await attendanceService.transitionClassSession(professor, opened.id, {state:"closed", reason:"Test"});
    await expect(attendanceService.transitionClassSession(studentA, opened.id, {state:"draft", reason:"Test"})).rejects.toMatchObject({status:403});
    const reset = await attendanceService.transitionClassSession(professor, opened.id, {state:"draft", reason:"Professor test reset"});
    expect(reset.state).toBe("draft");
    expect(reset.checkinEndsAt).toBeNull();
    expect(await sql`select id from qr_challenges where session_id = ${opened.id}`).toHaveLength(0);
    expect(await sql`select id from audit_log where subject_id = ${opened.id} and reason = 'Professor test reset'`).toHaveLength(1);
    const relaunched = await attendanceService.launchCourseSession(professor, 2, "lab", "G1");
    expect(relaunched.id).toBe(opened.id);
    expect(relaunched.state).toBe("open");
  });
});

it("does not reset a class with recorded attendance", async () => {
  const opened = await attendanceService.launchCourseSession(professor, 2, "lab", "G1");
  await importAndActivate(opened.semesterId, studentA, "RESET-01", "Arta Kola", "G1");
  const challenge = await attendanceService.createChallenge(professor, opened.id, "198.51.100.91");
  await attendanceService.checkIn(studentA, {token:challenge.token}, "198.51.100.92");
  await attendanceService.transitionClassSession(professor, opened.id, {state:"closed", reason:"Complete"});
  await expect(attendanceService.transitionClassSession(professor, opened.id, {state:"draft", reason:"Reset"})).rejects.toMatchObject({code:"session_has_records"});
  expect(await sql`select id from attendance_records where session_id = ${opened.id}`).toHaveLength(1);
});


describe("student preparation before class", () => {
  it("saves a current-course profile without recording attendance", async () => {
    const {semesterId}=await attendanceService.ensureCurrentCourseSetup(professor);
    const input={semesterId,studentId:"READY-01",firstName:"Arta",lastName:"Kola",email:"ready@example.com",groupName:"G1" as const,beforeClass:true};
    await attendanceService.activateRoster(studentA,input,"198.51.100.95");
    expect(await sql`select id from attendance_records`).toHaveLength(0);
    const history=await attendanceService.getStudentHistory(studentA);
    expect(history.profile?.fullName).toBe("Arta Kola");
    const opened=await attendanceService.launchCourseSession(professor,2,"lab","G1");
    const waiting=await attendanceService.getStudentHistory(studentA);
    expect(waiting.sessions.find(s=>s.id===opened.id)?.status).toBe("pending");
    expect(waiting.totals.absent).toBe(0);
    const qr=await attendanceService.createChallenge(professor,opened.id,"198.51.100.96");
    await attendanceService.checkIn(studentA,{token:qr.token},"198.51.100.97");
    expect((await attendanceService.getStudentHistory(studentA)).totals.present).toBe(1);
  });
});

it("pre-class registration cannot enrol into another or archived semester", async () => {
  const other = await createActiveSemester();
  const input={semesterId:other.id,studentId:"BEFORE-OTHER",firstName:"Arta",lastName:"Kola",email:"before@example.com",groupName:"G1" as const,beforeClass:true};
  await expect(attendanceService.activateRoster(studentA,input,"198.51.100.98")).rejects.toMatchObject({status:409});
  const {semesterId}=await attendanceService.ensureCurrentCourseSetup(professor);
  await attendanceService.transitionSemester(professor,semesterId,{state:"archived",reason:"Test archive"});
  await expect(attendanceService.activateRoster(studentA,{...input,semesterId},"198.51.100.99")).rejects.toMatchObject({status:409});
  expect(await sql`select id from attendance_records`).toHaveLength(0);
});
