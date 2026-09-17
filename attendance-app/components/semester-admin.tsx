"use client";

import { FormEvent, useEffect, useState } from "react";

import { SessionAdmin } from "./session-admin";

interface Semester {
  id: string;
  title: string;
  weekCount: number;
  status: "draft" | "active" | "archived";
}

interface CreatedSession {
  id: string;
  title: string;
}

interface ErrorBody {
  error?: { message?: string };
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json()) as T | ErrorBody;
  if (!response.ok) {
    throw new Error((body as ErrorBody).error?.message ?? "Kërkesa dështoi.");
  }
  return body as T;
}

export function SemesterAdmin() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSession, setSelectedSession] = useState<CreatedSession | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSemesters() {
    try {
      setSemesters(await jsonRequest<Semester[]>("/api/semesters", { cache: "no-store" }));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Semestrat nuk mund të ngarkohen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadSemesters);
  }, []);

  async function createSemester(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await jsonRequest<Semester>("/api/semesters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          weekCount: Number(form.get("weekCount")),
        }),
      });
      event.currentTarget.reset();
      await loadSemesters();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Semestri nuk mund të krijohet.");
    }
  }

  async function importRoster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rows = String(form.get("rows") ?? "")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(line.includes("\t") ? "\t" : ",").map((cell) => cell.trim()))
      .filter(([studentId]) => studentId?.toLocaleLowerCase("sq") !== "student id")
      .map(([studentId, fullName, groupName]) => ({ studentId, fullName, groupName }));
    if (!rows.length || rows.some((row) => !row.studentId || !row.fullName || !row.groupName)) {
      setMessage("Përdor një rresht për student: Student ID, Emri i plotë, Grupi.");
      return;
    }
    try {
      await jsonRequest("/api/roster/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ semesterId: form.get("semesterId"), rows }),
      });
      event.currentTarget.reset();
      setMessage(`${rows.length} studentë u importuan në një transaksion.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Regjistri nuk mund të importohet.");
    }
  }

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const created = await jsonRequest<CreatedSession>("/api/class-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          semesterId: form.get("semesterId"),
          weekNumber: Number(form.get("weekNumber")),
          kind: form.get("kind"),
          groupName: form.get("groupName"),
          title: form.get("title"),
        }),
      });
      setSelectedSession(created);
      setMessage("Sesioni u krijua. Jep arsyen dhe hape kur të fillojë ora.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sesioni nuk mund të krijohet.");
    }
  }

  const activeSemesters = semesters.filter(({ status }) => status === "active");

  return (
    <div className="admin-stack">
      {loading ? <p role="status">Duke ngarkuar panelin…</p> : null}
      {message ? <p className="admin-message" role="status">{message}</p> : null}

      <section className="admin-section" aria-labelledby="semesters-title">
        <h2 id="semesters-title">Semestrat</h2>
        <form className="admin-form admin-form-inline" onSubmit={createSemester}>
          <label htmlFor="semester-title">Titulli</label>
          <input id="semester-title" name="title" maxLength={200} required />
          <label htmlFor="semester-weeks">Javë</label>
          <input id="semester-weeks" name="weekCount" type="number" min={1} max={52} defaultValue={15} required />
          <button type="submit">Krijo semestrin</button>
        </form>
        <div className="semester-list">
          {semesters.map((semester) => (
            <SemesterRow key={semester.id} semester={semester} onChanged={loadSemesters} onError={setMessage} />
          ))}
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-section" aria-labelledby="roster-title">
          <h2 id="roster-title">Importo regjistrin</h2>
          <form className="admin-form" onSubmit={importRoster}>
            <label htmlFor="roster-semester">Semestri</label>
            <select id="roster-semester" name="semesterId" required>
              <option value="">Zgjidh</option>
              {semesters.filter(({ status }) => status !== "archived").map((semester) => (
                <option key={semester.id} value={semester.id}>{semester.title}</option>
              ))}
            </select>
            <label htmlFor="roster-rows">Student ID, Emri i plotë, Grupi</label>
            <textarea id="roster-rows" name="rows" rows={7} placeholder="12345, Arta Kola, G1" required />
            <button type="submit">Importo të gjithë rreshtat</button>
          </form>
        </section>

        <section className="admin-section" aria-labelledby="new-session-title">
          <h2 id="new-session-title">Krijo sesion</h2>
          <form className="admin-form" onSubmit={createSession}>
            <label htmlFor="session-semester">Semestri aktiv</label>
            <select id="session-semester" name="semesterId" required>
              <option value="">Zgjidh</option>
              {activeSemesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.title}</option>)}
            </select>
            <label htmlFor="session-title">Titulli</label>
            <input id="session-title" name="title" maxLength={200} required />
            <label htmlFor="session-week">Java</label>
            <input id="session-week" name="weekNumber" type="number" min={1} max={52} required />
            <label htmlFor="session-kind">Lloji</label>
            <select id="session-kind" name="kind"><option value="lecture">Ligjëratë</option><option value="lab">Ushtrime</option></select>
            <label htmlFor="session-group">Grupi</label>
            <input id="session-group" name="groupName" maxLength={100} required />
            <button type="submit">Krijo sesionin</button>
          </form>
        </section>
      </div>

      {selectedSession ? <SessionAdmin sessionId={selectedSession.id} /> : null}
    </div>
  );
}

function SemesterRow({
  semester,
  onChanged,
  onError,
}: {
  semester: Semester;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [reason, setReason] = useState("");

  async function transition() {
    const state = semester.status === "draft" ? "active" : "archived";
    if (!reason.trim()) {
      onError("Aktivizimi dhe arkivimi kërkojnë arsye auditi.");
      return;
    }
    try {
      await jsonRequest(`/api/semesters/${semester.id}/state`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, reason: reason.trim() }),
      });
      setReason("");
      await onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Gjendja nuk mund të ndryshohet.");
    }
  }

  return (
    <article className="semester-row">
      <div><strong>{semester.title}</strong><span>{semester.weekCount} javë · {semester.status}</span></div>
      <a href={`/api/semesters/${semester.id}/export`} download>Eksporto CSV</a>
      {semester.status !== "archived" ? (
        <>
          <label className="sr-only" htmlFor={`semester-reason-${semester.id}`}>Arsyeja për {semester.title}</label>
          <input
            id={`semester-reason-${semester.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Arsye auditi"
            maxLength={500}
          />
          <button type="button" onClick={() => void transition()}>
            {semester.status === "draft" ? "Aktivizo" : "Arkivo"}
          </button>
        </>
      ) : null}
    </article>
  );
}
