import { createHash, createHmac } from "node:crypto";

import type { Session } from "next-auth";
import postgres from "postgres";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  bootstrapProfessor,
  type BootstrapRepository,
  type BootstrapTransaction,
} from "../../app/api/admin/bootstrap/route";
import { POST as activateRoute } from "../../app/api/roster/activate/route";
import {
  AttendanceServiceError,
  attendanceService,
  attendanceServiceErrorResponse,
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

beforeAll(async () => {
  await sql`select 1`;
});

beforeEach(async () => {
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

  it("preserves an exact positive Retry-After and uses only the first forwarded IP", async () => {
    const request = new Request("http://attendance.test", {
      headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.1" },
    });
    expect(firstForwardedIp(request)).toBe("203.0.113.4");

    const response = attendanceServiceErrorResponse(
      new AttendanceServiceError(
        429,
        "rate_limited",
        "Too many requests",
        17,
      ),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
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
  function repository(failAudit = false): BootstrapRepository {
    return {
      async transaction<T>(
        work: (transaction: BootstrapTransaction) => Promise<T>,
      ): Promise<T> {
        return sql.begin(async (transaction) =>
          work({
            async findUserByGithubId(githubId) {
              const [row] = await transaction`
                select id, github_id from users where github_id = ${githubId}
              `;
              return row
                ? { id: row.id as string, githubId: row.github_id as string }
                : null;
            },
            async claimCompletion(userId) {
              const rows = await transaction`
                insert into bootstrap_state (completed_by)
                values (${userId}) on conflict (singleton) do nothing
                returning singleton
              `;
              return rows.length === 1;
            },
            async addProfessor(userId) {
              await transaction`
                insert into staff (user_id, role, added_by)
                values (${userId}, 'professor', ${userId})
                on conflict (user_id) do nothing
              `;
            },
            async recordBootstrapAudit(actorUserId, subjectId) {
              if (failAudit) {
                throw new Error("injected audit failure");
              }
              await transaction`
                insert into audit_log (
                  actor_user_id, action, subject_type, subject_id, reason
                ) values (
                  ${actorUserId}, 'staff.bootstrap', 'staff', ${subjectId},
                  'Initial professor bootstrap'
                )
              `;
            },
          }),
        ) as Promise<T>;
      },
    };
  }

  it("rolls back the marker and role when its audit write fails", async () => {
    await sql`delete from staff`;
    await expect(
      bootstrapProfessor(professor, "100", repository(true)),
    ).rejects.toThrow("injected audit failure");
    expect(await sql`select 1 from bootstrap_state`).toHaveLength(0);
    expect(await sql`select 1 from staff`).toHaveLength(0);
  });

  it("allows exactly one concurrent bootstrap winner", async () => {
    await sql`delete from staff`;
    const results = await Promise.all([
      bootstrapProfessor(professor, "100", repository()),
      bootstrapProfessor(professor, "100", repository()),
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
