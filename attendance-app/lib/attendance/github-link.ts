import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Session } from "next-auth";
import type { GitHubUserRecord } from "../auth/options";
import { getEnv } from "../env";
import { attendanceService } from "./service";
import { consumeLimit, type ClassroomStudent } from "./classroom-registration";
import { CURRENT_COURSE } from "./current-course";
export const LINK_COOKIE = "student-github-link";
const database = async () => (await import("../db/client")).db;
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export class GitHubLinkError extends Error {}
export async function ensureGitHubLinkSchema() {
  const db = await database();
  const ready = await db.execute(
    sql`select to_regclass('public.student_github_link_intents') is not null and to_regclass('public.student_project_links') is not null as ready`,
  );
  if (ready[0]?.ready) return;
  await db.execute(
    sql`create table if not exists student_github_link_intents(token_hash text primary key,roster_id uuid not null references roster(id) on delete restrict,user_id uuid not null references users(id) on delete restrict,expires_at timestamptz not null,consumed_at timestamptz)`,
  );
  await db.execute(
    sql`create table if not exists student_project_links(roster_id uuid primary key references roster(id) on delete restrict,repository_url text not null,github_id text not null,updated_at timestamptz not null default now())`,
  );
}
async function ownProfile(session: Session | null) {
  const report = await attendanceService.getCourseActivityReport(session);
  if (!report.viewerRosterId || report.viewerIsStaff)
    throw new GitHubLinkError("student_required");
  const db = await database();
  const rows = await db.execute(
    sql`select r.id,r.user_id,r.email,r.full_name,r.semester_id,u.github_id,u.github_username from roster r join users u on u.id=r.user_id where r.id=${report.viewerRosterId}`,
  );
  if (rows.length !== 1) throw new GitHubLinkError("student_required");
  return rows[0];
}
export async function beginGitHubLink(session: Session | null) {
  const p = await ownProfile(session),
    db = await database();
  await consumeLimit(db, "github_link_start", String(p.id), 10);
  await ensureGitHubLinkSchema();
  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`delete from student_github_link_intents where roster_id=${p.id} or expires_at<now()`,
    );
    await tx.execute(
      sql`insert into student_github_link_intents(token_hash,roster_id,user_id,expires_at) values(${hash(token)},${p.id},${p.user_id},now()+interval '10 minutes')`,
    );
  });
  return token;
}
export async function completeGitHubLink(
  token: string,
  record: GitHubUserRecord,
): Promise<ClassroomStudent> {
  if (
    !/^[0-9a-f]{64}$/.test(token) ||
    !/^\d+$/.test(record.githubId) ||
    record.githubId === getEnv().PROFESSOR_GITHUB_ID
  )
    throw new GitHubLinkError("invalid_link");
  const db = await database();
  await ensureGitHubLinkSchema();
  return db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`select r.id,r.user_id,r.email,r.full_name,r.semester_id from student_github_link_intents i join roster r on r.id=i.roster_id and r.user_id=i.user_id join semesters s on s.id=r.semester_id where i.token_hash=${hash(token)} and i.expires_at>clock_timestamp() and i.consumed_at is null and s.title=${CURRENT_COURSE.title} and s.status='active' for update of i,r`,
    );
    if (rows.length !== 1 || !rows[0].email)
      throw new GitHubLinkError("invalid_link");
    const p = rows[0];
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["github-link", record.githubId])},0))`,
    );
    const current = await tx.execute(
      sql`select u.id,u.github_id from users u left join staff st on st.user_id=u.id where u.id=${p.user_id} and st.user_id is null and (u.github_id is null or u.github_id<>${getEnv().PROFESSOR_GITHUB_ID}) for update of u`,
    );
    if (current.length !== 1) throw new GitHubLinkError("staff_forbidden");
    // Never transfer, detach, delete or modify another user's identity, even if unbound.
    const conflict = await tx.execute(
      sql`select id from users where github_id=${record.githubId} and id<>${p.user_id}`,
    );
    if (conflict.length) throw new GitHubLinkError("account_already_linked");
    await tx.execute(
      sql`update users set github_id=${record.githubId},github_username=${record.githubLogin},updated_at=now() where id=${p.user_id}`,
    );
    await tx.execute(
      sql`delete from student_project_links where roster_id=${p.id} and github_id<>${record.githubId}`,
    );
    const used = await tx.execute(
      sql`update student_github_link_intents set consumed_at=now() where token_hash=${hash(token)} and expires_at>clock_timestamp() returning token_hash`,
    );
    if (!used.length) throw new GitHubLinkError("invalid_link");
    await tx.execute(
      sql`insert into audit_log(actor_user_id,action,subject_type,subject_id,reason,metadata) values(${p.user_id},'student.github_link','roster',${p.id},'Student confirmed their own GitHub account with OAuth',${JSON.stringify({ previousGithubId: current[0].github_id, githubId: record.githubId })}::jsonb)`,
    );
    return {
      id: String(p.user_id),
      rosterId: String(p.id),
      semesterId: String(p.semester_id),
      name: String(p.full_name),
      email: String(p.email).trim().toLowerCase(),
      authMethod: "classroom",
    };
  });
}
export function parseRepositoryUrl(value: string) {
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    throw new GitHubLinkError("invalid_repository");
  }
  const m = u.pathname.match(/^\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/?$/);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "github.com" ||
    u.port ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !m
  )
    throw new GitHubLinkError("invalid_repository");
  const repo = m[2].replace(/\.git$/i, "");
  if (!repo || repo === "." || repo === "..")
    throw new GitHubLinkError("invalid_repository");
  return { owner: m[1], repo };
}
export async function verifyRepository(
  url: string,
  githubId: string,
  load: typeof fetch = fetch,
) {
  const { owner, repo } = parseRepositoryUrl(url);
  const response = await load(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new GitHubLinkError("repository_unavailable");
  const d = await response.json();
  if (String(d.owner?.id) !== githubId || d.private || d.fork)
    throw new GitHubLinkError("repository_not_owned");
  const c = parseRepositoryUrl(`https://github.com/${d.full_name}`);
  return `https://github.com/${c.owner}/${c.repo}`;
}
export async function saveStudentRepository(
  session: Session | null,
  url: string,
) {
  const p = await ownProfile(session);
  if (!p.github_id) throw new GitHubLinkError("github_required");
  const db = await database();
  await consumeLimit(db, "student_repo_save", String(p.id), 10);
  const repository = await verifyRepository(url, String(p.github_id));
  await ensureGitHubLinkSchema();
  const saved = await db.execute(
    sql`insert into student_project_links(roster_id,repository_url,github_id) select r.id,${repository},${p.github_id} from roster r join users u on u.id=r.user_id where r.id=${p.id} and u.github_id=${p.github_id} on conflict(roster_id) do update set repository_url=excluded.repository_url,github_id=excluded.github_id,updated_at=now() returning roster_id`,
  );
  if (!saved.length) throw new GitHubLinkError("identity_changed");
  return { repository };
}
export async function studentGitHubProfile(session: Session | null) {
  const p = await ownProfile(session);
  await ensureGitHubLinkSchema();
  const db = await database();
  const rows = await db.execute(
    sql`select repository_url from student_project_links where roster_id=${p.id} and github_id=${p.github_id}`,
  );
  return {
    githubLogin: p.github_username,
    repository: rows[0]?.repository_url ?? null,
  };
}
