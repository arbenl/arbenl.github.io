import { createHmac, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { getEnv } from "../env";
import { attendanceService } from "./service";
import { consumeLimit, type ClassroomStudent } from "./classroom-registration";
import { CURRENT_COURSE } from "./current-course";
const database = async () => (await import("../db/client")).db;
export function normalizeAccessCode(code: string) {
  return code.replace(/[\s-]/g, "").toLowerCase();
}
export function accessHash(code: string) {
  return createHmac("sha256", getEnv().RATE_LIMIT_SECRET)
    .update("student-access:" + normalizeAccessCode(code))
    .digest("hex");
}
export async function ensureStudentAccessSchema() {
  const db = await database();
  const ready = await db.execute(
    sql`select to_regclass('public.student_access_keys') is not null as ready`,
  );
  if (!ready[0]?.ready)
    await db.execute(
      sql`create table if not exists student_access_keys(roster_id uuid primary key references roster(id) on delete restrict,key_hash text not null,created_at timestamptz not null default now())`,
    );
}
export async function createStudentAccessCode(session: Session | null) {
  const report = await attendanceService.getCourseActivityReport(session);
  if (!report.viewerRosterId) throw new Error("student_required");
  await ensureStudentAccessSchema();
  const db = await database();
  const code = randomBytes(10).toString("hex");
  await db.execute(
    sql`insert into student_access_keys(roster_id,key_hash) values(${report.viewerRosterId},${accessHash(code)}) on conflict(roster_id) do update set key_hash=excluded.key_hash,created_at=now()`,
  );
  return {
    code: code
      .toUpperCase()
      .match(/.{1,4}/g)!
      .join("-"),
  };
}
export async function loginStudentAccess(
  input: { email?: string; code?: string },
  ip: string,
): Promise<ClassroomStudent> {
  const email = (input.email ?? "").trim().toLowerCase(),
    code = normalizeAccessCode(input.code ?? "");
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !/^[a-f0-9]{20}$/.test(code)
  )
    throw new Error("invalid_access");
  const db = await database();
  await consumeLimit(db, "student_access_ip", ip, 300);
  await consumeLimit(db, "student_access_identity", email, 10);
  await ensureStudentAccessSchema();
  const rows = await db.execute(
    sql`select r.id as roster_id,r.user_id,r.full_name,r.email,r.semester_id from student_access_keys k join roster r on r.id=k.roster_id join semesters s on s.id=r.semester_id join users u on u.id=r.user_id left join staff st on st.user_id=u.id where lower(trim(r.email))=${email} and k.key_hash=${accessHash(code)} and s.title=${CURRENT_COURSE.title} and s.status='active' and st.user_id is null and (u.github_id is null or u.github_id<>${getEnv().PROFESSOR_GITHUB_ID})`,
  );
  if (rows.length !== 1) throw new Error("invalid_access");
  const row = rows[0];
  return {
    id: String(row.user_id),
    rosterId: String(row.roster_id),
    name: String(row.full_name),
    email: String(row.email).trim().toLowerCase(),
    semesterId: String(row.semester_id),
    authMethod: "classroom",
  };
}
