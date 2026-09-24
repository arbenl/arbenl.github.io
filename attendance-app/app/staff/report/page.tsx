import Link from "next/link";

import { attendanceService } from "../../../lib/attendance/service";
import { CURRENT_COURSE } from "../../../lib/attendance/current-course";
import { getCurrentSession, requireStaff } from "../../../lib/auth/session";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  present: "I pranishëm",
  absent: "Mungesë",
  excused: "E arsyetuar",
  rejected: "E refuzuar",
  pending: "Ora është e hapur",
};

export default async function AttendanceReportPage({ searchParams }: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await getCurrentSession();
  try {
    await requireStaff(session);
  } catch {
    return (
      <main className="page-shell" id="permbajtja-kryesore">
        <section className="status-card">
          <p className="eyebrow">Vetëm për profesorin</p>
          <h1>Raporti i vijueshmërisë</h1>
          <p>Hyr me llogarinë e autorizuar GitHub për të parë raportin.</p>
          <Link className="admin-link" href="/api/auth/signin?callbackUrl=/staff/report">Hyr me GitHub</Link>
        </section>
      </main>
    );
  }

  const report = await attendanceService.getWeeklyAttendanceReport(session);
  const { week: requestedWeek } = await searchParams;
  const availableWeeks = [...new Set(report.rows.map((row) => row.weekNumber))].sort((a, b) => a - b);
  const parsedWeek = Number(requestedWeek);
  const selectedWeek = Number.isInteger(parsedWeek) && parsedWeek >= 1 && parsedWeek <= CURRENT_COURSE.weekCount
    ? parsedWeek
    : (availableWeeks.at(-1) ?? 1);
  const weekRows = report.rows.filter((row) => row.weekNumber === selectedWeek);
  const sessionIds = [...new Set(weekRows.map((row) => row.sessionId))];
  const count = (value: string) => weekRows.filter((row) => row.present === value).length;

  return (
    <main className="admin-shell attendance-report" id="permbajtja-kryesore">
      <header className="admin-page-header">
        <p className="eyebrow">Vetëm për profesorin · {report.semesterTitle}</p>
        <h1>Raporti i vijueshmërisë</h1>
        <p>Çdo orë e mbajtur, sipas javës. “Jo” vendoset vetëm pasi check-in-i mbyllet; gjatë orës studenti pa konfirmim shënohet “Në pritje”.</p>
        <div className="report-actions">
          <Link className="admin-link" href="/staff">← Paneli i profesorit</Link>
          <a className="admin-link" href={`/api/semesters/${report.semesterId}/export`}>Shkarko tabelën CSV</a>
        </div>
      </header>

      <nav className="report-week-picker" aria-label="Zgjidh javën e raportit">
        {Array.from({ length: CURRENT_COURSE.weekCount }, (_, index) => index + 1).map((week) => (
          <Link key={week} href={`/staff/report?week=${week}`} aria-current={week === selectedWeek ? "page" : undefined}>
            Java {week}
          </Link>
        ))}
      </nav>

      <section className="admin-section" aria-labelledby="report-week-title">
        <h2 id="report-week-title">Java {selectedWeek}</h2>
        {sessionIds.length ? (
          <p className="report-overview">{sessionIds.length} orë · {count("Po")} Po · {count("Jo")} Jo{count("Në pritje") ? ` · ${count("Në pritje")} në pritje` : ""}</p>
        ) : (
          <p>Nuk ka ende orë të hapur ose të përfunduar për këtë javë.</p>
        )}
      </section>

      {sessionIds.map((sessionId) => {
        const rows = weekRows.filter((row) => row.sessionId === sessionId);
        const first = rows[0];
        const yes = rows.filter((row) => row.present === "Po").length;
        return (
          <section className="admin-section" key={sessionId} aria-labelledby={`report-session-${sessionId}`}>
            <div className="report-session-heading">
              <div>
                <p className="eyebrow">Java {selectedWeek} · {first.kind === "lecture" ? "Ligjëratë" : "Ushtrime"} · {first.sessionGroup}</p>
                <h2 id={`report-session-${sessionId}`}>{first.sessionTitle}</h2>
                <p>{first.state === "open" ? "Ora është ende e hapur" : "Ora përfundoi"} · <strong>{yes}/{rows.length} prezent</strong></p>
              </div>
              <Link className="admin-link" href={`/staff?sessionId=${sessionId}#session-admin-title`}>Hap regjistrin</Link>
            </div>
            <div className="report-table-scroll">
              <table className="report-table">
                <caption>Vijueshmëria për {first.sessionTitle}</caption>
                <thead><tr><th scope="col">Nr.</th><th scope="col">Studenti</th><th scope="col">Student ID</th><th scope="col">Grupi</th><th scope="col">Prezent</th><th scope="col">Statusi</th><th scope="col">Koha</th></tr></thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.sessionId}-${row.studentId}`}>
                      <td>{index + 1}</td>
                      <th scope="row">{row.fullName}</th>
                      <td>{row.studentId}</td>
                      <td>{row.studentGroup}</td>
                      <td><strong className={`report-presence ${row.present === "Po" ? "is-present" : row.present === "Jo" ? "is-absent" : "is-pending"}`}>{row.present}</strong></td>
                      <td>{statusLabels[row.status] ?? row.status}</td>
                      <td>{row.recordedAt ? new Intl.DateTimeFormat("sq-AL", { timeZone: "Europe/Belgrade", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(row.recordedAt)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </main>
  );
}
