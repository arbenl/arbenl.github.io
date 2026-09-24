"use client";

import { useEffect, useState } from "react";

import { SignIn } from "../../components/sign-in";

interface HistorySession {
  id: string;
  semesterTitle: string;
  title: string;
  weekNumber: number;
  kind: "lecture" | "lab";
  status: "present" | "excused" | "rejected" | "absent" | "pending";
  recordedAt: string | null;
}

interface StudentHistory {
  profile?: { fullName: string; studentId: string; groupName: string; email: string | null } | null;
  sessions: HistorySession[];
  totals: {
    sessions: number;
    present: number;
    excused: number;
    rejected: number;
    absent: number;
  };
}

const statusLabels: Record<HistorySession["status"], string> = {
  present: "E pranishme",
  excused: "E arsyetuar",
  rejected: "E refuzuar",
  absent: "Mungesë",
  pending: "Regjistrimi është i hapur",
};

export default function StudentPage() {
  const [history, setHistory] = useState<StudentHistory | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/student/history", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setState("auth");
          return;
        }
        if (!response.ok) {
          throw new Error("Historia nuk mund të ngarkohet.");
        }
        setHistory((await response.json()) as StudentHistory);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setState("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="page-shell" id="permbajtja-kryesore">
      <section className="status-card student-card" aria-labelledby="history-title">
        <p className="eyebrow">Profili i studentit</p>
        <h1 id="history-title">Historia e vijueshmërisë</h1>
        <aside className="student-checkin-guide" aria-label="Si bëhet check-in">
          <strong>Si bëhet check-in?</strong>
          <p>
            QR-ja shfaqet nga profesori në projektor gjatë orës. Hape kamerën e telefonit,
            skanoje QR-në dhe ndiq lidhjen; regjistrimi përfundon në atë faqe.
          </p>
        </aside>
        <p><a href="https://arbenl.github.io/lendet/2026-2027/mobile/dorezimet.html">Detyrat dhe dorëzimet →</a></p>
        {state === "loading" ? <p role="status">Duke ngarkuar…</p> : null}
        {state === "auth" ? (
          <div className="student-stack">
            <p>Hyr me GitHub. Përdor të njëjtën llogari gjatë gjithë semestrit.</p>
            <a className="admin-link" href="/student/activate">Regjistrohu për herë të parë</a>
            <SignIn callbackUrl="/student" />
          </div>
        ) : null}
        {state === "error" ? <div><p role="alert">Historia nuk mund të ngarkohet. Kontrollo lidhjen dhe provo përsëri.</p><button className="student-control" onClick={() => window.location.reload()}>Provo përsëri</button></div> : null}
        {state === "ready" && history ? (
          <>
            {history.profile ? <p className="student-checkin-guide"><strong>{history.profile.fullName} · {history.profile.groupName}</strong><br />Profili yt është ruajtur. Në orën tjetër vetëm skano QR-në.</p>
              : <p className="student-checkin-guide">Bëje gati profilin para orës. <a href="/student/activate">Regjistrohu një herë →</a></p>}
            <dl className="history-totals">
              <div><dt>Gjithsej</dt><dd>{history.totals.sessions}</dd></div>
              <div><dt>Vijueshmëria</dt><dd>{history.totals.present} e pranishme</dd></div>
              <div><dt>Të arsyetuara</dt><dd>{history.totals.excused} e arsyetuar</dd></div>
              <div><dt>Të refuzuara</dt><dd>{history.totals.rejected} e refuzuar</dd></div>
              <div><dt>Mungesa</dt><dd>{history.totals.absent}</dd></div>
            </dl>
            {history.sessions.length === 0 ? (
              <p>Nuk ka ende sesione në historinë tënde.</p>
            ) : (
              <ul className="history-list">
                {history.sessions.map((session) => (
                  <li key={session.id}>
                    <div>
                      <span className="history-semester">{session.semesterTitle}</span>
                      <strong>{session.title}</strong>
                      <span>
                        Java {session.weekNumber} · {session.kind === "lecture" ? "Ligjëratë" : "Ushtrime"}
                      </span>
                      {session.recordedAt ? <time dateTime={session.recordedAt}>Regjistruar: {new Intl.DateTimeFormat("sq-AL", {timeZone:"Europe/Belgrade",dateStyle:"short",timeStyle:"short"}).format(new Date(session.recordedAt))}</time> : null}
                    </div>
                    <span className={`attendance-status status-${session.status}`}>
                      {statusLabels[session.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
