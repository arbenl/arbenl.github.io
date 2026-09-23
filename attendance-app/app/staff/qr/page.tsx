import { CourseLauncher } from "../../../components/course-launcher";
import { requireCurrentStaff } from "../../../lib/auth/session";
import { CURRENT_COURSE_SESSIONS } from "../../../lib/attendance/current-course";
export const dynamic = "force-dynamic";
export default async function CourseQRPage({ searchParams }: {
  searchParams: Promise<{ week?: string; kind?: string }>;
}) {
  const { week: rawWeek, kind } = await searchParams;
  const week = Number(rawWeek);
  if ((kind !== "lecture" && kind !== "lab") || !CURRENT_COURSE_SESSIONS.some((s) => s.weekNumber === week && s.kind === kind)) {
    return <main className="page-shell"><h1>Ora nuk është në kalendar</h1><a href="/staff">Paneli i profesorit</a></main>;
  }
  try { await requireCurrentStaff(); } catch {
    const callback = `/staff/qr?week=${week}&kind=${kind}`;
    return <main className="page-shell"><section className="status-card">
      <h1>QR-ja hapet vetëm nga profesori</h1>
      <p>Pas hyrjes hapet automatikisht QR-ja e javës {week}, {kind === "lecture" ? "ligjëratë" : "ushtrime"}.</p>
      <a className="admin-link" href={`/api/auth/signin?callbackUrl=${encodeURIComponent(callback)}`}>Hyr me GitHub</a>
    </section></main>;
  }
  return <CourseLauncher key={`${week}-${kind}`} week={week} kind={kind} />;
}
