import type { Session } from "next-auth";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registerClassroomStudent } from "../../lib/attendance/classroom-registration";
import { CURRENT_COURSE } from "../../lib/attendance/current-course";
import { attendanceService } from "../../lib/attendance/service";

const sql = postgres(process.env.DATABASE_URL!, { max: 3, onnotice: () => {} });
const professor: Session = { expires: "2099-01-01", user: { githubId: "100", githubLogin: "professor" } };
let session: Session;
let scopedSemester: string;
let otherSemester: string;
let scopedRoster: string;
let studentUser: string;
let professorUser: string;

beforeEach(async () => {
  await sql`truncate users, semesters restart identity cascade`;
  [professorUser, studentUser] = (await sql`insert into users (github_id, github_username) values ('100', 'professor'), ('200', 'student') returning id`).map(row => row.id);
  await sql`insert into staff (user_id, added_by, role) values (${professorUser}, ${professorUser}, 'professor')`;
  [scopedSemester, otherSemester] = (await sql`insert into semesters (title, week_count, status) values ('Scoped class', 15, 'active'), ('Other class', 15, 'active') returning id`).map(row => row.id);
  const rows = await sql`insert into roster (semester_id, user_id, student_id, full_name, group_name, email, activated_at) values
    (${scopedSemester}, ${studentUser}, 'S1', 'Student Name', 'G1', 'student@example.test', now()),
    (${otherSemester}, ${studentUser}, 'S1', 'Student Name', 'G1', 'student@example.test', now()) returning id`;
  scopedRoster = rows[0].id;
  await sql`insert into class_sessions (semester_id, week_number, kind, group_name, title, state, created_by, checkin_ends_at) values
    (${scopedSemester}, 1, 'lecture', 'G1', 'Scoped lecture', 'open', ${professorUser}, now() + interval '10 minutes'),
    (${otherSemester}, 1, 'lecture', 'G1', 'Private other lecture', 'open', ${professorUser}, now() + interval '10 minutes')`;
  session = { expires: '2099-01-01', user: { authMethod: 'classroom', userId: studentUser, rosterId: scopedRoster, semesterId: scopedSemester, email: 'student@example.test' } };
});
afterAll(async () => { await sql.end(); });

describe('scoped classroom sessions', () => {
  it('uses normalized session email with preserved legacy email spelling for history and check-in', async () => {
    await sql`update roster set full_name = 'Arta Test', email = ' Arta@Example.com ' where id = ${scopedRoster}`;
    const [classSession] = await sql`select id from class_sessions where semester_id = ${scopedSemester}`;
    const challenge = await attendanceService.createChallenge(professor, classSession.id, '192.0.2.10');
    const student = await registerClassroomStudent({token: challenge.token, email: 'arta@example.com', firstName: 'Arta', lastName: 'Test', studentId: 'S1', groupName: 'G1'}, '192.0.2.11');
    const classroom: Session = {expires:'2099-01-01', user:{...student, userId:student.id}};
    expect(student.email).toBe('arta@example.com');
    expect((await attendanceService.getStudentHistory(classroom)).profile).toMatchObject({email:' Arta@Example.com '});
    await attendanceService.checkIn(classroom, {token:challenge.token}, '192.0.2.12');
    const [record] = await sql`select roster_id, status from attendance_records`;
    expect(record).toMatchObject({roster_id:scopedRoster, status:'present'});
    expect((await sql`select email from roster where id = ${scopedRoster}`)[0].email).toBe(' Arta@Example.com ');
  });
  it('lists only its active semester and returns only its own roster history/profile', async () => {
    expect((await attendanceService.listSemesters(session)).map(row => row.id)).toEqual([scopedSemester]);
    const history = await attendanceService.getStudentHistory(session);
    expect(history.sessions.map(row => row.title)).toEqual(['Scoped lecture']);
    expect(history.profile).toMatchObject({ email: 'student@example.test', studentId: 'S1' });
    await sql`update semesters set status = 'archived' where id = ${scopedSemester}`;
    expect(await attendanceService.listSemesters(session)).toEqual([]);
  });
  it('denies staff actions, setup, activation shortcuts and another-semester QR', async () => {
    await expect(attendanceService.createSemester(session, {title: 'Forbidden', weekCount: 15})).rejects.toMatchObject({status:403});
    await expect(attendanceService.ensureCurrentCourseSetup(session)).rejects.toMatchObject({status:403});
    await expect(attendanceService.activateRoster(session, {semesterId: scopedSemester, firstName:'Student', lastName:'Name', studentId:'S1', beforeClass:true}, '192.0.2.1')).rejects.toMatchObject({status:403});
    const [other] = await sql`select id from class_sessions where semester_id = ${otherSemester}`;
    const challenge = await attendanceService.createChallenge(professor, other.id, '192.0.2.2');
    await expect(attendanceService.checkIn(session, {token:challenge.token}, '192.0.2.3')).rejects.toMatchObject({status:403});
    expect(await sql`select * from attendance_records`).toHaveLength(0);
    await sql`update semesters set title = ${CURRENT_COURSE.title} where id = ${otherSemester}`;
    await expect(attendanceService.getCourseActivityReport(session)).rejects.toMatchObject({status:403});
  });
  it('rechecks binding, email and staff membership on every actor resolution', async () => {
    session.user.rosterId = (await sql`select id from roster where semester_id = ${otherSemester}`)[0].id;
    await expect(attendanceService.getStudentHistory(session)).rejects.toMatchObject({status:401});
    session.user.rosterId = scopedRoster;
    await sql`update roster set email = 'changed@example.test' where id = ${scopedRoster}`;
    await expect(attendanceService.getStudentHistory(session)).rejects.toMatchObject({status:401});
    await sql`update roster set email = 'student@example.test' where id = ${scopedRoster}`;
    await sql`insert into staff (user_id, added_by, role) values (${studentUser}, ${professorUser}, 'administrator')`;
    await expect(attendanceService.getStudentHistory(session)).rejects.toMatchObject({status:403});
  });
  it('rejects professor-linked rows even without a staff membership', async () => {
    await sql`delete from staff where user_id = ${professorUser}`;
    await sql`update roster set user_id = ${professorUser} where id = ${scopedRoster}`;
    session.user.userId = professorUser;
    await expect(attendanceService.getStudentHistory(session)).rejects.toMatchObject({status:403});
  });
  it('requires the configured GitHub professor to list archived semesters', async () => {
    await sql`insert into staff (user_id, added_by, role) values (${studentUser}, ${professorUser}, 'administrator')`;
    await sql`update semesters set status = 'archived' where id = ${otherSemester}`;
    const githubStudent: Session = {expires:'2099-01-01', user:{githubId:'200',githubLogin:'student'}};
    expect((await attendanceService.listSemesters(githubStudent)).map(row => row.id)).toEqual([scopedSemester]);
    expect(await attendanceService.listSemesters(professor)).toHaveLength(2);
  });
});
