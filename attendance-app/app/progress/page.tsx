import Link from "next/link";
import { StudentGitHubLink } from "../../components/student-github-link";
import {
  StudentAccessLogin,
  StudentAccessCode,
  SwitchAccount,
} from "../../components/student-access";
import {
  attendanceService,
  AttendanceServiceError,
} from "../../lib/attendance/service";
import { getCurrentSession } from "../../lib/auth/session";
import { loadSubmissions } from "../../lib/attendance/submissions";
import { progressResults } from "../../lib/colloquium/service";
import { progressCards } from "../../lib/attendance/progress";
import { StudentProgress } from "../../components/student-progress";
export const dynamic = "force-dynamic";
export default async function ProgressPage({
  searchParams,
}: { searchParams?: Promise<{ github?: string }> } = {}) {
  const githubStatus = (await searchParams)?.github;
  const session = await getCurrentSession();
  let report;
  try {
    report = await attendanceService.getCourseActivityReport(session);
  } catch (error) {
    if (
      !(error instanceof AttendanceServiceError) ||
      ![401, 403].includes(error.status)
    )
      throw error;
    return (
      <main className="page-shell" id="permbajtja-kryesore">
        <section className="status-card">
          <p className="eyebrow">Mobile 2026/2027</p>
          <h1>Karta e studentit</h1>
          <StudentAccessLogin />
          <p>
            Karta dhe regjistri hapen nga studentët e regjistruar në këtë lëndë
            dhe profesori.
          </p>
          <p>
            Përdor të njëjtin shfletues ku bëre regjistrimin me QR. Nëse ke
            profil me GitHub, hyr me të njëjtën llogari. Për regjistrimin e parë
            skano QR-në e profesorit gjatë orës.
          </p>
          <Link
            className="admin-link"
            href="/api/auth/signin?callbackUrl=/progress"
          >
            Hyr me GitHub
          </Link>
          <p>
            <Link href="https://arbenl.github.io/lendet/2026-2027/mobile/#javet">
              Vazhdo te materialet e lëndës →
            </Link>
          </p>
        </section>
      </main>
    );
  }
  const [submissions, tests] = await Promise.allSettled([
    loadSubmissions(),
    progressResults(session),
  ]);
  const cards = progressCards(
    report,
    submissions.status === "fulfilled" ? submissions.value : null,
    tests.status === "fulfilled" ? tests.value : null,
  );
  return (
    <main className="admin-shell" id="permbajtja-kryesore">
      <header className="admin-page-header">
        <p className="eyebrow">Programimi për Pajisje Mobile · 2026/2027</p>
        <h1>
          {report.viewerIsStaff
            ? "Regjistri i studentëve · Profesori Arben"
            : "Karta e studentit dhe regjistri i klasës"}
        </h1>
        <p>
          Hyrë si:{" "}
          <strong>
            {report.viewerIsStaff
              ? "Profesor Arben"
              : (session?.user?.name ?? "Student")}
          </strong>
        </p>
        <SwitchAccount />
        <p>
          Pjesëmarrja nga QR-ja, rezultatet e publikuara të testit dhe dorëzimet
          në GitHub.
        </p>
        <p>
          <Link
            className="admin-link"
            href="https://arbenl.github.io/lendet/2026-2027/mobile/#javet"
          >
            Hap ligjëratat dhe ushtrimet →
          </Link>{" "}
          · <Link href="/report">Raporti sipas javëve</Link>
        </p>
      </header>
      {githubStatus === "link_failed" && (
        <p role="alert">
          GitHub-i nuk u lidh. Llogaria mund të jetë e lidhur me një profil
          tjetër ose konfirmimi ka skaduar. Profili yt nuk u ndryshua.
        </p>
      )}
      {githubStatus === "linked" && (
        <p role="status">
          GitHub-i u konfirmua. Dorëzimet përditësohen brenda 5 minutave.
        </p>
      )}
      {!report.viewerIsStaff && report.viewerRosterId && (
        <>
          <StudentAccessCode />
          <StudentGitHubLink />
        </>
      )}
      <StudentProgress cards={cards} viewerId={report.viewerRosterId ?? null} />
    </main>
  );
}
