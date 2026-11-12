import { sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { requireStaff } from "../auth/session";
import { getEnv } from "../env";
import { CURRENT_COURSE } from "./current-course";
import { parseSubmissions, type SubmissionIssue } from "./submissions";
const database = async () => (await import("../db/client")).db;
export interface VerifiedSubmissionAccount {
  rosterId: string;
  githubId: string;
  login: string;
}
export async function ensureSubmissionAccountsSchema() {
  const db = await database();
  await db.execute(
    sql`create table if not exists student_submission_accounts(roster_id uuid not null references roster(id) on delete restrict,semester_id uuid not null references semesters(id) on delete restrict,github_id text not null,github_login text not null,source_issue integer not null,approved_by uuid not null references users(id) on delete restrict,reason text not null,updated_at timestamptz not null default now(),primary key(roster_id,github_id),unique(semester_id,github_id))`,
  );
}
export async function getSubmissionAccounts(
  semesterId: string,
): Promise<VerifiedSubmissionAccount[]> {
  const db = await database();
  const ready = await db.execute(
    sql`select to_regclass('public.student_submission_accounts') is not null as ready`,
  );
  if (!ready[0]?.ready) return [];
  const rows = await db.execute(
    sql`select roster_id,github_id,github_login from student_submission_accounts where semester_id=${semesterId}`,
  );
  return rows.map((row) => ({
    rosterId: String(row.roster_id),
    githubId: String(row.github_id),
    login: String(row.github_login),
  }));
}
export async function verifySubmissionAccount(
  session: Session | null,
  input: { rosterId: string; issue: number; reason: string },
  load: typeof fetch = fetch,
) {
  const staff = await requireStaff(session);
  if (
    !/^[0-9a-f-]{36}$/i.test(input.rosterId) ||
    !Number.isSafeInteger(input.issue) ||
    input.issue <= 0 ||
    input.reason.trim().length < 8 ||
    input.reason.length > 500
  )
    throw new Error("invalid_request");
  const response = await load(
    `https://api.github.com/repos/arbenl/arbenl-mobile-assignments-2026-2027/issues/${input.issue}`,
    {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error("issue_unavailable");
  const issue = (await response.json()) as SubmissionIssue;
  const source = parseSubmissions([issue])[0];
  if (
    !source ||
    source.number !== input.issue ||
    source.githubId === getEnv().PROFESSOR_GITHUB_ID
  )
    throw new Error("invalid_submission");
  await ensureSubmissionAccountsSchema();
  const db = await database();
  return db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`select r.id,r.semester_id,r.full_name from roster r join semesters s on s.id=r.semester_id where r.id=${input.rosterId} and s.title=${CURRENT_COURSE.title} and s.status='active' for update of r`,
    );
    if (rows.length !== 1) throw new Error("profile_not_found");
    const profile = rows[0];
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["submission-account", profile.semester_id, source.githubId])},0))`,
    );
    const conflict = await tx.execute(
      sql`select r.id from roster r join users u on u.id=r.user_id where r.semester_id=${profile.semester_id} and r.id<>${profile.id} and u.github_id=${source.githubId} union all select roster_id from student_submission_accounts where semester_id=${profile.semester_id} and roster_id<>${profile.id} and github_id=${source.githubId}`,
    );
    if (conflict.length) throw new Error("account_belongs_to_other_student");
    await tx.execute(
      sql`insert into student_submission_accounts(roster_id,semester_id,github_id,github_login,source_issue,approved_by,reason) values(${profile.id},${profile.semester_id},${source.githubId},${source.login},${input.issue},${staff.userId},${input.reason.trim()}) on conflict(roster_id,github_id) do update set github_login=excluded.github_login,source_issue=excluded.source_issue,approved_by=excluded.approved_by,reason=excluded.reason,updated_at=now()`,
    );
    await tx.execute(
      sql`insert into audit_log(actor_user_id,action,subject_type,subject_id,reason,metadata) values(${staff.userId},'student.submission_account_verified','roster',${profile.id},${input.reason.trim()},${JSON.stringify({ githubId: source.githubId, login: source.login, issue: input.issue })}::jsonb)`,
    );
    return {
      student: String(profile.full_name),
      login: source.login,
      sourceIssue: input.issue,
    };
  });
}
