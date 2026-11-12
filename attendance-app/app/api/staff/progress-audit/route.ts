import { sql } from "drizzle-orm";
import {
  getCurrentSession,
  requireStaff,
  AuthorizationError,
} from "../../../../lib/auth/session";
import { CURRENT_COURSE } from "../../../../lib/attendance/current-course";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireStaff(await getCurrentSession());
  } catch (e) {
    return Response.json(
      { error: "Vetëm profesori" },
      { status: e instanceof AuthorizationError ? e.status : 403 },
    );
  }
  const { db } = await import("../../../../lib/db/client");
  const rows =
    await db.execute(sql`select r.id,r.full_name,r.group_name,u.github_id,u.github_username,
 (select count(*)::int from attendance_records a join class_sessions c on c.id=a.session_id where a.roster_id=r.id and a.status='present' and c.state in ('open','closed')) as present,
 (select count(*)::int from attendance_records a where a.roster_id=r.id and a.status='present') as all_present,
 (select count(*)::int from roster x where x.id<>r.id and (x.student_id=r.student_id or (x.email is not null and lower(trim(x.email))=lower(trim(r.email))))) as related_profiles
 from roster r join semesters s on s.id=r.semester_id left join users u on u.id=r.user_id where s.title=${CURRENT_COURSE.title} and s.status='active' order by r.full_name`);
  return Response.json(
    { professorGithubId: process.env.PROFESSOR_GITHUB_ID, students: rows },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
