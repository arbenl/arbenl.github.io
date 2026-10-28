import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getEnv } from "../env";
import { hashChallengeToken } from "./challenge";
import { normalizeStudentId, registrationNamesMatch } from "./normalize";

type Database = (typeof import("../db/client"))["db"];
type Executor = Pick<Database, "execute">;
const database = async () => (await import("../db/client")).db;
const registrationSchema = z.object({
  token: z.string().min(16).max(256),
  email: z.string().trim().toLowerCase().email().max(254),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  studentId: z.string().trim().min(1).max(100),
  groupName: z.enum(["G1", "G2"]),
});

export class ClassroomRegistrationError extends Error {
  constructor(
    readonly status: 400 | 403 | 409 | 429,
    readonly code: "invalid_registration" | "invalid_qr" | "profile_conflict" | "staff_forbidden" | "rate_limited" | "classroom_unavailable",
    readonly retryAfter?: number,
  ) {
    // Error messages never disclose somebody else's profile or email.
    super(code);
    this.name = "ClassroomRegistrationError";
  }
}

// Only the authorized staff setup path calls this helper. Public readiness is read-only.
// Keep these statements equivalent to drizzle/0002_classroom_registration.sql.
export async function ensureClassroomRegistrationSchema(executor: Executor): Promise<void> {
  // The marker is created last, after the nullable-column migration succeeds.
  // Avoid acquiring AccessExclusiveLock on users during ordinary staff reads.
  const marker = await executor.execute(
    sql`select to_regclass('public.classroom_registrations') is not null as ready`,
  );
  if (marker[0]?.ready === true) return;
  await executor.execute(sql`alter table users alter column github_id drop not null`);
  await executor.execute(sql`alter table users alter column github_username drop not null`);
  await executor.execute(sql`create table if not exists classroom_registrations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete restrict,
    roster_id uuid not null references roster(id) on delete restrict,
    session_id uuid not null references class_sessions(id) on delete restrict,
    created_at timestamptz not null default now(),
    constraint classroom_registrations_roster_session_unique unique (roster_id, session_id)
  )`);
}

export async function classroomRegistrationReady(): Promise<boolean> {
  try {
    const db = await database();
    const result = await db.execute(sql`select to_regclass('public.classroom_registrations') is not null as ready`);
    return result[0]?.ready === true;
  } catch {
    return false;
  }
}

async function consumeLimit(db: Executor, action: string, subject: string, limit: number) {
  const key = createHmac("sha256", getEnv().RATE_LIMIT_SECRET).update(subject).digest().toString("hex");
  // This deliberately commits independently of enrollment, including failed identity matches.
  const rows = await db.execute(sql`
    insert into request_limits(action,key_hash,window_start,count,updated_at)
    values (${action},decode(${key},'hex'),to_timestamp(floor(extract(epoch from statement_timestamp())/600)*600),1,statement_timestamp())
    on conflict(action,key_hash,window_start) do update set count=request_limits.count+1,updated_at=statement_timestamp()
    returning count,greatest(1,ceil(extract(epoch from(window_start+interval '10 minutes'-statement_timestamp()))))::integer as retry_after
  `);
  if (Number(rows[0]?.count) > limit) throw new ClassroomRegistrationError(429, "rate_limited", Number(rows[0]?.retry_after));
}

interface Challenge { sessionId: string; semesterId: string }
interface Entry { id: string; fullName: string; email: string | null; userId: string | null }
export interface ClassroomStudent {
  id: string;
  name: string;
  email: string;
  authMethod: "classroom";
  semesterId: string;
  rosterId: string;
}

export async function registerClassroomStudent(input: unknown, ip: string): Promise<ClassroomStudent> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) throw new ClassroomRegistrationError(400, "invalid_registration");
  if (!await classroomRegistrationReady()) throw new ClassroomRegistrationError(409, "classroom_unavailable");
  const data = parsed.data;
  const studentId = normalizeStudentId(data.studentId);
  const name = `${data.firstName} ${data.lastName}`.replace(/\s+/gu, " ").normalize("NFC");
  const hash = hashChallengeToken(data.token);
  const db = await database();
  const candidates = await db.execute(sql`select session_id as "sessionId" from qr_challenges where token_hash=${hash}`);
  const sessionId = candidates[0]?.sessionId as string | undefined;
  // Invalid tokens share a bounded per-IP bucket, without retaining tokens or contact info.
  const scope = sessionId ?? "invalid";
  await consumeLimit(db, "classroom_ip", JSON.stringify([ip, scope]), 300);
  await consumeLimit(db, "classroom_identity", JSON.stringify([data.email, studentId, scope]), 10);
  if (!sessionId) throw new ClassroomRegistrationError(409, "invalid_qr");
  try {
    return await db.transaction(async tx => {
      // Same key and shared lock as checkIn; session changes take the exclusive lock.
      await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtextextended(${sessionId},0))`);
      const current = await tx.execute(sql`
        select cs.id as "sessionId",cs.semester_id as "semesterId"
        from qr_challenges q join class_sessions cs on cs.id=q.session_id join semesters s on s.id=cs.semester_id
        where q.token_hash=${hash} and cs.id=${sessionId} and cs.state='open' and s.status='active'
          and q.expires_at > statement_timestamp() and cs.checkin_ends_at > statement_timestamp()
      `);
      const challenge = current[0] as unknown as Challenge | undefined;
      if (!challenge) throw new ClassroomRegistrationError(409, "invalid_qr");
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["classroom-enroll", challenge.semesterId, studentId])},0))`);
      const rows = await tx.execute(sql`select id,full_name as "fullName",email,user_id as "userId" from roster where semester_id=${challenge.semesterId} and student_id=${studentId} for update`);
      let entry = rows[0] as unknown as Entry | undefined;
      if (entry && (!registrationNamesMatch(entry.fullName, name) || (entry.email !== null && entry.email.trim().toLowerCase() !== data.email))) {
        throw new ClassroomRegistrationError(409, "profile_conflict");
      }
      const protectedRows = await tx.execute(sql`
        select u.id from users u left join staff st on st.user_id=u.id
        where (st.user_id is not null or u.github_id=${getEnv().PROFESSOR_GITHUB_ID})
          and (u.id=${entry?.userId ?? null}::uuid or exists(select 1 from roster r where r.user_id=u.id and lower(trim(r.email))=${data.email}))
      `);
      if (protectedRows.length) throw new ClassroomRegistrationError(403, "staff_forbidden");
      const duplicateEmail = await tx.execute(sql`select id from roster where semester_id=${challenge.semesterId} and lower(trim(email))=${data.email} and student_id<>${studentId}`);
      if (duplicateEmail.length) throw new ClassroomRegistrationError(409, "profile_conflict");
      let userId = entry?.userId;
      if (!userId) {
        const created = await tx.execute(sql`insert into users(name) values (${entry?.fullName ?? name}) returning id`);
        userId = created[0].id as string;
      }
      if (entry) {
        await tx.execute(sql`update roster set user_id=${userId},activated_at=coalesce(activated_at,statement_timestamp()),email=coalesce(email,${data.email}),updated_at=statement_timestamp() where id=${entry.id}`);
      } else {
        const created = await tx.execute(sql`insert into roster(semester_id,student_id,full_name,email,group_name,user_id,activated_at) values (${challenge.semesterId},${studentId},${name},${data.email},${data.groupName},${userId},statement_timestamp()) returning id`);
        entry = {id:created[0].id as string,fullName:name,email:data.email,userId};
      }
      // Locks/creation may have waited: check the real server clock again before issuing identity.
      const valid = await tx.execute(sql`select q.id from qr_challenges q join class_sessions cs on cs.id=q.session_id join semesters s on s.id=cs.semester_id where q.token_hash=${hash} and cs.id=${sessionId} and cs.state='open' and s.status='active' and q.expires_at>clock_timestamp() and cs.checkin_ends_at>clock_timestamp()`);
      if (!valid.length) throw new ClassroomRegistrationError(409, "invalid_qr");
      await tx.execute(sql`insert into classroom_registrations(user_id,roster_id,session_id) values (${userId},${entry.id},${sessionId}) on conflict(roster_id,session_id) do nothing`);
      return {id:userId,name:entry.fullName,email:data.email,authMethod:"classroom" as const,semesterId:challenge.semesterId,rosterId:entry.id};
    });
  } catch (error) {
    if (error instanceof ClassroomRegistrationError) throw error;
    const cause = error instanceof Error && "cause" in error ? error.cause : error;
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505") throw new ClassroomRegistrationError(409, "profile_conflict");
    throw error;
  }
}
