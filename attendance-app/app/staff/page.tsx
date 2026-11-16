import Link from "next/link";
import courseSchedule from "../../lib/attendance/course-schedule.json";
import { getCourseMoment } from "../../lib/attendance/course-lifecycle.mjs";

import { SemesterAdmin } from "../../components/semester-admin";
import { AuthorizationError, requireCurrentStaff } from "../../lib/auth/session";

export const dynamic = "force-dynamic";

export default async function StaffPage({ searchParams }: {
  searchParams?: Promise<{ sessionId?: string | string[] }>;
} = {}) {
  try {
    await requireCurrentStaff();
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    return (
      <main className="page-shell" id="permbajtja-kryesore">
        <section className="status-card" aria-labelledby="staff-access-title">
          <p className="eyebrow">Paneli i profesorit · 2026/2027</p>
          <h1 id="staff-access-title">Staff access required</h1>
          <p>Programimi për Pajisje Mobile · Semestri dimëror 2026/2027.</p>
          <p>Hyr me llogarinë GitHub të autorizuar për stafin.</p>
          <Link className="admin-link" href="/api/auth/signin?callbackUrl=/staff">Hyr me GitHub</Link>
        </section>
      </main>
    );
  }

  const params = await searchParams;
  const sessionId = typeof params?.sessionId === "string" ? params.sessionId : undefined;

  const moment = getCourseMoment(courseSchedule);
  const focus = moment.nextWeek;
  const site = "https://arbenl.github.io";
  return (
    <main className="admin-shell" id="permbajtja-kryesore">
      <header className="admin-page-header">
        <p className="eyebrow">Paneli i profesorit · 2026/2027</p>
        <h1>Programimi për Pajisje Mobile</h1>
        <p>Orët, materialet dhe evidencat e lëndës.</p>
        <nav className="course-actions" aria-label="Veprimet e profesorit">
          <Link className="admin-link" href="#course-qr-title">Hap QR-në e orës</Link>
          <Link className="secondary-link" href="/progress">Regjistri i studentëve</Link>
          <Link className="secondary-link" href="/staff/report">Raporti sipas javëve</Link>
          <a className="secondary-link" href="https://arbenl.github.io/lendet/2026-2027/mobile/">Materialet e lëndës</a>
        </nav>
      </header>
      {focus ? <section className="admin-section course-focus" data-focus-week={focus.week} aria-labelledby="staff-focus-title">
        <p className="eyebrow">{moment.status === "today" ? "Sot" : "Ora e radhës"} · {focus.date.split("-").reverse().join(".")}</p>
        <h2 id="staff-focus-title">Java {focus.week} · {focus.title}</h2>
        <nav className="course-actions" aria-label="Materialet e orës së radhës">
          <a className="admin-link" href={site + focus.weekUrl}>Hap javën {focus.week}</a>
          {focus.lectureUrl && <a className="secondary-link" href={site + focus.lectureUrl}>Ligjërata</a>}
          {focus.labUrl && <a className="secondary-link" href={site + focus.labUrl}>Ushtrimet</a>}
          {focus.week === 7 && <Link className="admin-link" href="/staff/colloquium">Kolokviumi I · Grupet dhe fillimi</Link>}
        </nav>
        {!focus.lectureUrl && <p>Plani i javës është publikuar. Prezantimi ende nuk është shtuar.</p>}
      </section> : <section className="admin-section"><h2>Orari i semestrit përfundoi</h2><p>Regjistrat, rezultatet dhe materialet mbeten të arritshme nga kalendari dhe historiku.</p></section>}
      <details className="admin-section course-history">
        <summary>Historiku · Vlerësimet dhe materialet e javëve të kaluara</summary>
        <nav className="course-actions" aria-label="Historiku i lëndës">
          <Link className="secondary-link" href="/staff/colloquium#cq-results">Kolokviumi I · Java 7 · Rezultatet dhe grupet</Link>
          <Link className="secondary-link" href="/staff/colloquium/preview">Provë private e Kolokviumit I</Link>
          <Link className="secondary-link" href="/staff/materials/week-07">Java 7 · Arkiva e materialeve të profesorit</Link>
          <a className="secondary-link" href={site + "/lendet/2026-2027/mobile/syllabusi-2026-2027.html#java-14"}>Kolokviumi II · Java 14 · Plani në syllabus</a>
        </nav>
      </details>
      <SemesterAdmin key={sessionId} initialSessionId={sessionId} />
    </main>
  );
}
