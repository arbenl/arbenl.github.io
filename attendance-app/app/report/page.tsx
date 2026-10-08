import Link from "next/link";
import { attendanceService, AttendanceServiceError } from "../../lib/attendance/service";
import { CURRENT_COURSE } from "../../lib/attendance/current-course";
import { loadSubmissions } from "../../lib/attendance/submissions";
import { getCurrentSession } from "../../lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CourseReportPage({ searchParams }: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await getCurrentSession();
  let report;
  try {
    report = await attendanceService.getCourseActivityReport(session);
  } catch (error) {
    if (!(error instanceof AttendanceServiceError) || ![401, 403].includes(error.status)) throw error;
    return <main className="page-shell" id="permbajtja-kryesore"><section className="status-card">
      <h1>Raporti javor i klasës</h1>
      <p>Raporti hapet nga studentët e regjistruar në lëndë dhe profesori. Hyr me llogarinë GitHub që përdor për vijueshmërinë.</p>
      <Link className="admin-link" href="/api/auth/signin?callbackUrl=/report">Hyr me GitHub</Link>{" "}
      <Link href="/student/activate">Përgatit profilin për lëndën</Link>
    </section></main>;
  }
  const requested = Number((await searchParams).week);
  const week = Number.isInteger(requested) && requested >= 1 && requested <= CURRENT_COURSE.weekCount
    ? requested : Math.max(1, ...report.sessions.map(s => s.week));
  const sessions = report.sessions.filter(s => s.week === week).sort((a, b) => a.title.localeCompare(b.title, "sq"));
  let submissions: Awaited<ReturnType<typeof loadSubmissions>> | null;
  try { submissions = await loadSubmissions(); } catch { submissions = null; }
  const weeklySubmissions = submissions?.filter(s => s.week === week) ?? [];
  const present = new Set(report.present.map(r => `${r.rosterId}:${r.sessionId}`));
  const rosterAccounts = new Set(report.students.map(s => s.githubId));
  const unmatched = weeklySubmissions.filter(s => !rosterAccounts.has(s.githubId)).sort((a, b) => a.login.localeCompare(b.login));
  const participants = report.students.filter(student => sessions.some(s => present.has(`${student.rosterId}:${s.id}`))).length;
  return <main className="admin-shell attendance-report" id="permbajtja-kryesore">
    <header className="admin-page-header">
      <p className="eyebrow">Programimi Mobile · 2026/2027 · Për studentët dhe profesorin</p>
      <h1>Pjesëmarrja dhe detyrat sipas javëve</h1>
      <p>Emrat renditen sipas alfabetit shqip. Pjesëmarrja merret nga regjistri QR; dorëzimet nga formularët në GitHub, duke përfshirë edhe ato të mbyllura.</p>
      <p><Link href="https://arbenl.github.io/lendet/2026-2027/mobile/">← Faqja e lëndës</Link> · <Link href="/student">Vijueshmëria ime</Link></p>
    </header>
    <nav className="report-week-picker" aria-label="Zgjidh javën e raportit">
      {Array.from({ length: CURRENT_COURSE.weekCount }, (_, i) => i + 1).map(w => <Link key={w} href={`/report?week=${w}`} aria-current={w === week ? "page" : undefined}>Java {w}</Link>)}
    </nav>
    <section className="admin-section" aria-labelledby="activity-week">
      <h2 id="activity-week">Java {week}</h2>
      <p className="report-overview">{participants} studentë me pjesëmarrje të konfirmuar · {submissions ? `${weeklySubmissions.length} studentë me dorëzim` : "Dorëzimet përkohësisht të padisponueshme"}</p>
      <p>“Po” tregon check-in të konfirmuar. “—” tregon se nuk ka konfirmim në këtë orë; nuk është vendim për mungesën. “Nuk u gjet” do të thotë se nuk u gjet formular dorëzimi nga e njëjta llogari GitHub, jo se puna është vlerësuar. Dorëzimet përditësohen brenda 5 minutave.</p>
      {!sessions.length ? <p>Nuk ka ende orë të hapur ose të përfunduar këtë javë.</p> : null}
      {submissions === null ? <p role="alert">GitHub nuk mund të lexohet tani. Dorëzimet shënohen “E panjohur”; provo përsëri më vonë.</p> : null}
      <div className="report-table-scroll"><table className="report-table">
        <caption>Java {week} · {report.students.length} studentë · Renditje alfabetike sipas emrit</caption>
        <thead><tr><th scope="col">Nr.</th><th scope="col">Emri dhe mbiemri</th><th scope="col">Grupi</th>
          {sessions.map(s => <th key={s.id} scope="col">{s.kind === "lecture" ? "Ligjëratë" : "Ushtrime"} · {s.groupName}<br /><small>{s.state === "open" ? "Check-in i hapur" : "Check-in i mbyllur"}</small></th>)}
          <th scope="col">Detyra · Java {week}</th></tr></thead>
        <tbody>{report.students.map((student, i) => {
          const submission = weeklySubmissions.find(s => s.githubId === student.githubId);
          return <tr key={student.rosterId}><td>{i + 1}</td><th scope="row">{student.fullName}</th><td>{student.groupName}</td>
            {sessions.map(s => <td key={s.id}>{present.has(`${student.rosterId}:${s.id}`) ? <strong className="report-presence is-present">Po</strong> : "—"}</td>)}
            <td>{submission ? <a href={submission.url}>Dorëzuar · #{submission.number}</a> : submissions === null ? "E panjohur" : "Nuk u gjet"}</td></tr>;
        })}</tbody>
      </table></div>
    </section>
    {unmatched.length ? <section className="admin-section"><h2>Dorëzime pa profil të lidhur · Java {week}</h2><p>Këto llogari kanë dorëzuar, por nuk përputhen me një profil në regjistrin e lëndës. Përgatit profilin me të njëjtën llogari GitHub që përdore për dorëzim.</p>
      <ul>{unmatched.map(s => <li key={s.githubId}><a href={s.url}>{s.login} · Dorëzuar #{s.number}</a></li>)}</ul></section> : null}
  </main>;
}
