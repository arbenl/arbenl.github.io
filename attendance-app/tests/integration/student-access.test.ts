import postgres from "postgres";
import { beforeEach, afterAll, expect, it } from "vitest";
import { CURRENT_COURSE } from "../../lib/attendance/current-course";
import { attendanceService } from "../../lib/attendance/service";
import {
  createStudentAccessCode,
  loginStudentAccess,
} from "../../lib/attendance/student-access";
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let session: Parameters<typeof createStudentAccessCode>[0];
let rosterId: string, userId: string;
beforeEach(async () => {
  await sql`truncate users,semesters restart identity cascade`;
  await sql`truncate request_limits`;
  const [s] =
    await sql`insert into semesters(title,week_count,status) values(${CURRENT_COURSE.title},15,'active') returning id`;
  const [u] =
    await sql`insert into users(name) values('Arta Prova') returning id`;
  userId = u.id;
  const [r] =
    await sql`insert into roster(semester_id,student_id,full_name,email,group_name,user_id,activated_at) values(${s.id},'ACCESS-1','Arta Prova','arta@example.com','G1',${u.id},now()) returning id`;
  rosterId = r.id;
  session = {
    expires: "2099-01-01",
    user: {
      authMethod: "classroom",
      userId: u.id,
      rosterId: r.id,
      semesterId: s.id,
      email: "arta@example.com",
      name: "Arta Prova",
    },
  };
});
afterAll(() => sql.end());
it("creates a personal key and signs in to exactly the existing profile without recording presence", async () => {
  const { code } = await createStudentAccessCode(session);
  const identity = await loginStudentAccess(
    { email: " ARTA@example.com ", code },
    "192.0.2.1",
  );
  expect(identity).toMatchObject({
    id: userId,
    rosterId,
    email: "arta@example.com",
  });
  expect(await sql`select id from roster`).toHaveLength(1);
  expect(await sql`select id from attendance_records`).toHaveLength(0);
  const hashes =
    await sql`select key_hash from student_access_keys where roster_id=${rosterId}`;
  expect(hashes[0].key_hash).not.toContain(code);
  const report = await attendanceService.getCourseActivityReport(session);
  expect(report.viewerRosterId).toBe(rosterId);
});
it("rejects wrong email or key and revokes the old key after rotation", async () => {
  const old = await createStudentAccessCode(session);
  const next = await createStudentAccessCode(session);
  await expect(
    loginStudentAccess(
      { email: "arta@example.com", code: old.code },
      "192.0.2.1",
    ),
  ).rejects.toThrow("invalid_access");
  await expect(
    loginStudentAccess(
      { email: "other@example.com", code: next.code },
      "192.0.2.1",
    ),
  ).rejects.toThrow("invalid_access");
  await expect(
    loginStudentAccess(
      { email: "arta@example.com", code: next.code },
      "192.0.2.1",
    ),
  ).resolves.toMatchObject({ rosterId });
});
it("keeps professor accounts out of student cards even when an old roster entry is bound to them", async () => {
  await sql`update users set github_id='100',github_username='professor' where id=${userId}`;
  await sql`insert into staff(user_id,role) values(${userId},'professor')`;
  const staffSession = {
    expires: "2099-01-01",
    user: { githubId: "100", githubLogin: "professor" },
  };
  const report = await attendanceService.getCourseActivityReport(staffSession);
  expect(report.viewerRosterId).toBeNull();
  expect(report.viewerIsStaff).toBe(true);
  expect(report.students).toHaveLength(0);
  await expect(createStudentAccessCode(staffSession)).rejects.toThrow(
    "student_required",
  );
});
it("blocks excessive key guesses for one email even across changing IPs", async () => {
  await createStudentAccessCode(session);
  for (let i = 0; i < 10; i++)
    await expect(
      loginStudentAccess(
        { email: "arta@example.com", code: "0".repeat(20) },
        "192.0.2." + i,
      ),
    ).rejects.toThrow("invalid_access");
  await expect(
    loginStudentAccess(
      { email: "arta@example.com", code: "0".repeat(20) },
      "192.0.2.100",
    ),
  ).rejects.toMatchObject({ code: "rate_limited" });
});
