import { CourseLauncher } from "../../../components/course-launcher";
import { requireCurrentStaff } from "../../../lib/auth/session";
import { CURRENT_COURSE_SESSIONS } from "../../../lib/attendance/current-course";
export const dynamic = "force-dynamic";
export default async function CourseQRPage({ searchParams }: {
  searchParams: Promise<{ week?: string; kind?: string; group?: string }>;
}) {
  const { week: rawWeek, kind, group } = await searchParams;
  const week = Number(rawWeek);
  if ((kind !== "lecture" && kind !== "lab") || !CURRENT_COURSE_SESSIONS.some((s) => s.weekNumber === week && s.kind === kind)) {
    return <main className="page-shell"><h1>Ora nuk është në kalendar</h1><a href="/staff">Paneli i profesorit</a></main>;
  }
  if (kind === "lab" && group !== "G1" && group !== "G2") {
    return <main className="page-shell"><h1>Ushtrimet · Java {week}</h1>
      <p>Zgjidh grupin e ushtrimeve.</p>
      <a className="admin-link" href={`/staff/qr?week=${week}&kind=lab&group=G1`}>G1 · 14:45</a>{" "}
      <a className="admin-link" href={`/staff/qr?week=${week}&kind=lab&group=G2`}>G2 · 18:00</a>
    </main>;
  }
  const labGroup = kind === "lab" ? group as "G1" | "G2" : undefined;
  try { await requireCurrentStaff(); } catch {
    const callback = `/staff/qr?week=${week}&kind=${kind}${labGroup ? `&group=${labGroup}` : ""}`;
    return <main className="page-shell"><section className="status-card">
      <h1>QR-ja hapet vetëm nga profesori</h1>
      <p>Pas hyrjes hapet automatikisht QR-ja e javës {week}, {kind === "lecture" ? "ligjëratë" : "ushtrime"}.</p>
      <a className="admin-link" href={`/api/auth/signin?callbackUrl=${encodeURIComponent(callback)}`}>Hyr me GitHub</a>
    </section></main>;
  }
  return <CourseLauncher key={`${week}-${kind}-${labGroup}`} week={week} kind={kind} group={labGroup} />;
}
