import { sql } from "drizzle-orm";
import {
  getCurrentSession,
  requireStaff,
  AuthorizationError,
} from "../../../../lib/auth/session";
import { attendanceService } from "../../../../lib/attendance/service";
import { CURRENT_COURSE } from "../../../../lib/attendance/current-course";
import {
  loadSubmissions,
  mapSubmissionAccounts,
} from "../../../../lib/attendance/submissions";
import { progressCards } from "../../../../lib/attendance/progress";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getCurrentSession();
  try {
    await requireStaff(session);
  } catch (e) {
    return Response.json(
      { error: "Vetëm profesori" },
      {
        status: e instanceof AuthorizationError ? e.status : 403,
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  }
  const report = await attendanceService.getCourseActivityReport(session);
  const { db } = await import("../../../../lib/db/client");
  const [semester] = await db.execute(
    sql`select id from semesters where title=${CURRENT_COURSE.title} and status='active'`,
  );
  const [profiles, attendance, tests] = await Promise.all([
    db.execute(
      sql`select r.id,r.student_id,r.full_name,r.email,r.group_name,r.user_id,u.github_id,u.github_username from roster r left join users u on u.id=r.user_id where r.semester_id=${semester.id} and (u.github_id is null or u.github_id<>${process.env.PROFESSOR_GITHUB_ID})`,
    ),
    db.execute(
      sql`select a.roster_id,a.session_id,a.status,c.kind,c.state,c.week_number,c.group_name from attendance_records a join class_sessions c on c.id=a.session_id where c.semester_id=${semester.id}`,
    ),
    db.execute(
      sql`select a.roster_id,a.week_number,a.score from colloquium_attempts a join colloquium_rooms c on c.id=a.room_id where a.semester_id=${semester.id} and c.deadline<=clock_timestamp() and a.score is not null`,
    ),
  ]);
  let submissions: Awaited<ReturnType<typeof loadSubmissions>> | null;
  try {
    submissions = await loadSubmissions();
  } catch {
    submissions = null;
  }
  const testResults = tests.map((t) => ({
    rosterId: String(t.roster_id),
    week: Number(t.week_number),
    score: Number(t.score),
    maxScore: 10,
  }));
  const generatedAt = new Date();
  const cards = progressCards(
    report,
    submissions ? mapSubmissionAccounts(submissions, report.students) : null,
    testResults,
    generatedAt,
  );
  return Response.json(
    {
      version: 1,
      course: CURRENT_COURSE.title,
      semesterId: semester.id,
      generatedAt: generatedAt.toISOString(),
      profiles,
      attendance,
      tests: testResults,
      submissions,
      report,
      cards,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Robots-Tag": "noindex",
        "Content-Disposition":
          'attachment; filename="mobile-2026-course-audit.json"',
      },
    },
  );
}
