import postgres from "postgres";
import { beforeEach, afterAll, expect, it } from "vitest";
import type { Session } from "next-auth";
import { CURRENT_COURSE } from "../../lib/attendance/current-course";
import { attendanceService } from "../../lib/attendance/service";
import {
  beginGitHubLink,
  completeGitHubLink,
} from "../../lib/attendance/github-link";
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
