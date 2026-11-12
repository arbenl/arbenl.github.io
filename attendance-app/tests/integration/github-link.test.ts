import postgres from "postgres";
import { verifySubmissionAccount } from "../../lib/attendance/submission-accounts";
import { mapSubmissionAccounts } from "../../lib/attendance/submissions";
import type { Account, Profile, User } from "next-auth";
import { encode, decode } from "next-auth/jwt";
import { createAuthOptions } from "../../lib/auth/options";
import { parseSubmissions } from "../../lib/attendance/submissions";
import { progressCards } from "../../lib/attendance/progress";
import { progressResults } from "../../lib/colloquium/service";
import { beforeEach, afterAll, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { CURRENT_COURSE } from "../../lib/attendance/current-course";
import { attendanceService } from "../../lib/attendance/service";
import {
  beginGitHubLink,
  completeGitHubLink,
} from "../../lib/attendance/github-link";
// Refuse destructive fixture cleanup outside the harness-owned local database.
vi.mock("../../lib/colloquium/bank", () => ({
  getQuestionBank: () =>
    Array.from({ length: 10 }, (_, i) => ({
      id: `synthetic-${i}`,
      prompt: "Synthetic fixture only",
      source: "Local test only",
      correctOptionId: "yes",
      options: [
        { id: "yes", text: "A" },
        { id: "no1", text: "B" },
        { id: "no2", text: "C" },
      ],
    })),
}));
const testDatabase = new URL(process.env.DATABASE_URL ?? "invalid:");
if (
  testDatabase.hostname !== "127.0.0.1" ||
  testDatabase.pathname !== "/attendance_test"
)
  throw new Error("Disposable local attendance_test database required");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let session: Session, rosterId: string, userId: string;
beforeEach(async () => {
  await sql`truncate users,semesters restart identity cascade`;
  await sql`truncate request_limits`;
  const [s] =
    await sql`insert into semesters(title,week_count,status) values(${CURRENT_COURSE.title},15,'active') returning id`;
  const [u] =
    await sql`insert into users(name) values('Arta Test') returning id`;
  userId = u.id;
  const [r] =
    await sql`insert into roster(semester_id,student_id,full_name,email,group_name,user_id,activated_at) values(${s.id},'GITHUB-1','Arta Test','arta@example.com','G1',${u.id},now()) returning id`;
  rosterId = r.id;
  session = {
    expires: "2099-01-01",
    user: {
      authMethod: "classroom",
      userId,
      rosterId,
      semesterId: s.id,
      email: "arta@example.com",
    },
  };
});
afterAll(() => sql.end());
it("links a free account to the same profile; normal GitHub login finds the original roster", async () => {
  const token = await beginGitHubLink(session);
  const linked = await completeGitHubLink(token, {
    githubId: "777",
    githubLogin: "arta",
    name: "Arta",
  });
  expect(linked).toMatchObject({ id: userId, rosterId });
  expect(await sql`select id from roster`).toHaveLength(1);
  expect(await sql`select id from users`).toHaveLength(1);
  const report = await attendanceService.getCourseActivityReport({
    expires: "2099",
    user: { githubId: "777", githubLogin: "arta" },
  });
  expect(report.viewerRosterId).toBe(rosterId);
  expect(report.students[0].githubId).toBe("777");
  expect(await sql`select id from attendance_records`).toHaveLength(0);
  expect(
    await sql`select id from audit_log where action='student.github_link'`,
  ).toHaveLength(1);
  await expect(
    completeGitHubLink(token, {
      githubId: "888",
      githubLogin: "other",
      name: null,
    }),
  ).rejects.toThrow("invalid_link");
});
it("refuses any other user identity, including unbound users, without modifying either account", async () => {
  const [other] =
    await sql`insert into users(github_id,github_username) values('888','someone') returning id`;
  const token = await beginGitHubLink(session);
  await expect(
    completeGitHubLink(token, {
      githubId: "888",
      githubLogin: "someone",
      name: null,
    }),
  ).rejects.toThrow("account_already_linked");
  expect(
    (await sql`select github_id from users where id=${other.id}`)[0].github_id,
  ).toBe("888");
  expect(
    (await sql`select github_id from users where id=${userId}`)[0].github_id,
  ).toBeNull();
});
it("refuses expired, replaced, forged and professor-account link attempts", async () => {
  const old = await beginGitHubLink(session),
    token = await beginGitHubLink(session);
  await expect(
    completeGitHubLink(old, {
      githubId: "777",
      githubLogin: "arta",
      name: null,
    }),
  ).rejects.toThrow("invalid_link");
  await expect(
    completeGitHubLink("0".repeat(64), {
      githubId: "777",
      githubLogin: "arta",
      name: null,
    }),
  ).rejects.toThrow("invalid_link");
  await expect(
    completeGitHubLink(token, {
      githubId: process.env.PROFESSOR_GITHUB_ID!,
      githubLogin: "professor",
      name: null,
    }),
  ).rejects.toThrow("invalid_link");
  await sql`update student_github_link_intents set expires_at=now()-interval '1 second'`;
  await expect(
    completeGitHubLink(token, {
      githubId: "777",
      githubLogin: "arta",
      name: null,
    }),
  ).rejects.toThrow("invalid_link");
});
it("preserves the existing check-in and test records when changing the students own free GitHub identity", async () => {
  await sql`update users set github_id='777',github_username='old-arta' where id=${userId}`;
  const [c] =
    await sql`insert into class_sessions(semester_id,week_number,kind,group_name,title,state,created_by) values(${session.user.semesterId!},1,'lecture','G1','Test','closed',${userId}) returning id`;
  const [a] =
    await sql`insert into attendance_records(session_id,roster_id,status,scanned_at) values(${c.id},${rosterId},'present',now()) returning *`;
  const [room] =
    await sql`insert into colloquium_rooms(semester_id,week_number,group_name,token_hash,created_by) values(${session.user.semesterId!},7,'G1',${Buffer.alloc(32, 1)},${userId}) returning id`;
  const [test] =
    await sql`insert into colloquium_attempts(room_id,semester_id,week_number,user_id,roster_id,question_order,score,submitted_at) values(${room.id},${session.user.semesterId!},7,${userId},${rosterId},'[]'::jsonb,9,now()) returning *`;
  const token = await beginGitHubLink(session);
  await completeGitHubLink(token, {
    githubId: "999",
    githubLogin: "new-arta",
    name: null,
  });
  expect(
    (await sql`select * from attendance_records where id=${a.id}`)[0],
  ).toEqual(a);
  expect(
    (await sql`select user_id from roster where id=${rosterId}`)[0].user_id,
  ).toBe(userId);
  expect(
    (await sql`select * from colloquium_attempts where id=${test.id}`)[0],
  ).toEqual(test);
  expect(
    (await attendanceService.getCourseActivityReport(session)).present,
  ).toHaveLength(1);
});

function callbackArgs<T extends (...a: never[]) => unknown>(
  _cb: T,
  value: Parameters<T>[0],
): Parameters<T>[0] {
  return value;
}
it("recognizes submissions after linking and a fresh-device GitHub session while preserving attendance and test points", async () => {
  const [prof] =
    await sql`insert into users(github_id,github_username) values('100','professor') returning id`;
  const [c] =
    await sql`insert into class_sessions(semester_id,week_number,kind,group_name,title,state,created_by) values(${session.user.semesterId!},8,'lab','G1','Fixture Lab','closed',${prof.id}) returning id`;
  await sql`insert into attendance_records(session_id,roster_id,status,scanned_at) values(${c.id},${rosterId},'present',now())`;
  const [room] =
    await sql`insert into colloquium_rooms(semester_id,week_number,group_name,token_hash,created_by,started_at,deadline) values(${session.user.semesterId!},7,'G1',${Buffer.alloc(32, 2)},${prof.id},now()-interval '11 minutes',now()-interval '1 minute') returning id`;
  await sql`insert into colloquium_attempts(room_id,semester_id,user_id,roster_id,question_order,score,submitted_at) values(${room.id},${session.user.semesterId!},${userId},${rosterId},'[]'::jsonb,9,now()-interval '1 minute')`;
  const attendanceBefore =
      await sql`select * from attendance_records order by id`,
    testsBefore = await sql`select * from colloquium_attempts order by id`;
  const submissions = parseSubmissions(
    [1, 2].map((week) => ({
      number: week,
      title: "[MOBILE DORËZIM]",
      body: `### Java\n\nJava ${week}\n\n### Linku i punës në GitHub\n\nhttps://github.com/ilda-sh/example`,
      html_url: `https://github.com/example/course/issues/${week}`,
      created_at: "2026-10-01",
      user: { id: 281168996, login: "ilda-sh" },
    })),
  );
  const now = new Date("2026-11-12T12:00:00Z");
  expect(
    progressCards(
      await attendanceService.getCourseActivityReport(session),
      submissions,
      [],
      now,
    )[0].percentage,
  ).toBeNull();
  const environment = {
    GITHUB_ID: process.env.GITHUB_ID!,
    GITHUB_SECRET: process.env.GITHUB_SECRET!,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  };
  const intent = await beginGitHubLink(session),
    opts = createAuthOptions(environment, {
      linkGitHub: (record) => completeGitHubLink(intent, record),
    });
  const account: Account = {
      provider: "github",
      type: "oauth",
      providerAccountId: "281168996",
    },
    profile = { id: 281168996, login: "ilda-sh" } as Profile,
    user: User = { id: "281168996", name: "GitHub display" };
  const signIn = opts.callbacks!.signIn!;
  expect(await signIn(callbackArgs(signIn, { user, account, profile }))).toBe(
    true,
  );
  const linkJwt = opts.callbacks!.jwt!;
  expect(
    await linkJwt(
      callbackArgs(linkJwt, {
        token: {},
        user,
        account,
        profile,
        trigger: "signIn",
      }),
    ),
  ).toMatchObject({ rosterId, userId, authMethod: "classroom" });
  const fresh = createAuthOptions(environment),
    newUser: User = { id: "281168996", name: "Different display name" };
  const freshSignIn = fresh.callbacks!.signIn!;
  expect(
    await freshSignIn(
      callbackArgs(freshSignIn, { user: newUser, account, profile }),
    ),
  ).toBe(true);
  const jwt = fresh.callbacks!.jwt!;
  const token = await jwt(
    callbackArgs(jwt, {
      token: {},
      user: newUser,
      account,
      profile,
      trigger: "signIn",
    }),
  );
  const encoded = await encode({
      secret: environment.NEXTAUTH_SECRET,
      token,
      maxAge: 3600,
    }),
    decoded = await decode({
      secret: environment.NEXTAUTH_SECRET,
      token: encoded,
    });
  expect(decoded).not.toBeNull();
  const sc = fresh.callbacks!.session!;
  const freshSession = (await sc(
    callbackArgs(sc, {
      session: { expires: "2099-01-01", user: {} },
      token: decoded!,
      user: { id: userId, email: "arta@example.com", emailVerified: null },
      newSession: undefined,
      trigger: "update",
    }),
  )) as Session;
  const report = await attendanceService.getCourseActivityReport(freshSession);
  expect(report.viewerRosterId).toBe(rosterId);
  const card = progressCards(
    report,
    submissions,
    await progressResults(freshSession),
    now,
  )[0];
  expect(card).toMatchObject({
    id: rosterId,
    total: 1,
    lab: 1,
    submitted: 2,
    percentage: 22,
  });
  expect(card.tests![0].score).toBe(9);
  expect(await sql`select * from attendance_records order by id`).toEqual(
    attendanceBefore,
  );
  expect(await sql`select * from colloquium_attempts order by id`).toEqual(
    testsBefore,
  );
  expect(await sql`select id from roster`).toHaveLength(1);
});

it("adds a verified submission source without changing the student login, profile, attendance or score", async () => {
  const [prof] =
    await sql`insert into users(github_id,github_username) values('100','professor') returning id`;
  await sql`insert into staff(user_id,role) values(${prof.id},'professor')`;
  await sql`update users set github_id='281168996',github_username='ilda-sh' where id=${userId}`;
  const beforeUser = (await sql`select * from users where id=${userId}`)[0],
    beforeRoster = (await sql`select * from roster where id=${rosterId}`)[0];
  const [c] =
    await sql`insert into class_sessions(semester_id,week_number,kind,group_name,title,state,created_by) values(${session.user.semesterId!},8,'lab','G1','Fixture Lab','closed',${prof.id}) returning id`;
  const [a] =
    await sql`insert into attendance_records(session_id,roster_id,status,scanned_at) values(${c.id},${rosterId},'present',now()) returning *`;
  const [room] =
    await sql`insert into colloquium_rooms(semester_id,week_number,group_name,token_hash,created_by) values(${session.user.semesterId!},7,'G1',${Buffer.alloc(32, 3)},${prof.id}) returning id`;
  const [test] =
    await sql`insert into colloquium_attempts(room_id,semester_id,user_id,roster_id,question_order,score,submitted_at) values(${room.id},${session.user.semesterId!},${userId},${rosterId},'[]'::jsonb,9,now()) returning *`;
  const source = {
    number: 647,
    title: "[MOBILE DORËZIM]",
    body: "### Java\n\nJava 6\n\n### Linku i punës në GitHub\n\nhttps://github.com/ildasheholli/rideshare-mobile",
    created_at: "2026-10-22",
    html_url:
      "https://github.com/arbenl/arbenl-mobile-assignments-2026-2027/issues/647",
    user: { id: 333398587, login: "ildasheholli" },
  };
  const load = vi.fn().mockImplementation(async () => Response.json(source));
  await expect(
    verifySubmissionAccount(
      session,
      { rosterId, issue: 647, reason: "Teacher verified the source" },
      load,
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(load).not.toHaveBeenCalled();
  const staffSession = {
    expires: "2099",
    user: { githubId: "100", githubLogin: "professor" },
  };
  await verifySubmissionAccount(
    staffSession,
    { rosterId, issue: 647, reason: "Teacher verified the source" },
    load,
  );
  const report = await attendanceService.getCourseActivityReport(session);
  const mapped = mapSubmissionAccounts(
    parseSubmissions([source]),
    report.students,
  );
  expect(
    progressCards(report, mapped, [], new Date("2026-11-12T12:00:00Z"))[0],
  ).toMatchObject({
    id: rosterId,
    total: 1,
    submitted: 1,
    percentage: 11,
    submissionLogins: ["ildasheholli"],
  });
  expect((await sql`select * from users where id=${userId}`)[0]).toEqual(
    beforeUser,
  );
  expect((await sql`select * from roster where id=${rosterId}`)[0]).toEqual(
    beforeRoster,
  );
  expect(
    (await sql`select * from attendance_records where id=${a.id}`)[0],
  ).toEqual(a);
  expect(
    (await sql`select * from colloquium_attempts where id=${test.id}`)[0],
  ).toEqual(test);
  const [other] =
    await sql`insert into users(github_id,github_username) values('444','other') returning id`;
  const [otherRoster] =
    await sql`insert into roster(semester_id,student_id,full_name,email,group_name,user_id,activated_at) values(${session.user.semesterId!},'OTHER','Other Student','other@example.test','G1',${other.id},now()) returning id`;
  await expect(
    verifySubmissionAccount(
      staffSession,
      {
        rosterId: otherRoster.id,
        issue: 647,
        reason: "Wrong student must be refused",
      },
      load,
    ),
  ).rejects.toThrow("account_belongs_to_other_student");
});
