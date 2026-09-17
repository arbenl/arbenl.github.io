"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type SessionState = "draft" | "open" | "closed" | "cancelled";
type AttendanceStatus = "present" | "rejected" | "excused";

interface PrivateSession {
  id: string;
  title: string;
  state: SessionState;
  weekNumber: number;
  kind: "lecture" | "lab";
  groupName: string;
  checkinEndsAt: string | null;
}

interface PrivateRecord {
  id: string | null;
  rosterId: string;
  fullName: string;
  studentId: string;
  githubUsername: string | null;
  status: AttendanceStatus | "absent";
  recordedAt: string | null;
}

interface RecordsResponse {
  session: PrivateSession;
  records: PrivateRecord[];
}

interface SessionAdminProps {
  sessionId: string;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

const statusLabels = {
  present: "I pranishëm",
  excused: "I arsyetuar",
  rejected: "I refuzuar",
} as const;

export function SessionAdmin({ sessionId }: SessionAdminProps) {
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stateReason, setStateReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const response = await fetch(`/api/class-sessions/${sessionId}/records`, {
        cache: "no-store",
      });
      const body = (await response.json()) as RecordsResponse | ErrorBody;
      if (!response.ok) {
        throw new Error((body as ErrorBody).error?.message ?? "Sesioni nuk mund të ngarkohet.");
      }
      if (version !== loadVersion.current) return null;
      const records = body as RecordsResponse;
      setData(records);
      setLoadError(null);
      return records.session.state;
    } catch (loadError) {
      if (version === loadVersion.current) {
        setLoadError(loadError instanceof Error ? loadError.message : "Sesioni nuk mund të ngarkohet.");
      }
      return null;
    }
  }, [sessionId]);

  useEffect(() => {
    void Promise.resolve().then(load);
    return () => { loadVersion.current += 1; };
  }, [load]);

  const sessionState = data?.session.state;
  useEffect(() => {
    if (busy || (sessionState !== "draft" && sessionState !== "open")) return;
    let active = true;
    let timer: number;
    async function refresh() {
      const state = await load();
      if (active && state !== "closed" && state !== "cancelled") {
        timer = window.setTimeout(refresh, 1_000);
      }
    }
    timer = window.setTimeout(refresh, 1_000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [busy, load, sessionState]);

  async function transition(state: Exclude<SessionState, "draft">) {
    if (!stateReason.trim()) {
      setError("Shkruaj arsyen e ndryshimit të sesionit.");
      return;
    }
    setBusy(true);
    loadVersion.current += 1; // Ignore snapshots started before this mutation.
    setNotice(null);
    try {
      const response = await fetch(`/api/class-sessions/${sessionId}/state`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, reason: stateReason.trim() }),
      });
      const body = (await response.json()) as PrivateSession | ErrorBody;
      if (!response.ok) {
        throw new Error((body as ErrorBody).error?.message ?? "Gjendja nuk mund të ndryshohet.");
      }
      setStateReason("");
      setError(null);
      await load();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "Ndodhi një gabim.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRecord(
    record: PrivateRecord,
    status: AttendanceStatus,
    reason: string,
  ) {
    if (!reason.trim()) {
      setError(`Shkruaj arsyen për ${record.fullName}.`);
      return false;
    }
    setBusy(true);
    loadVersion.current += 1; // Ignore snapshots started before this mutation.
    setNotice(null);
    try {
      const response = await fetch(
        record.id
          ? `/api/records/${record.id}`
          : `/api/class-sessions/${sessionId}/records`,
        {
          method: record.id ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(record.id
            ? { status, reason: reason.trim() }
            : { rosterId: record.rosterId, status, reason: reason.trim() }),
        },
      );
      const body = (await response.json()) as { id?: string; status?: AttendanceStatus } | ErrorBody;
      if (!response.ok) {
        if ((body as ErrorBody).error?.code === "record_exists") {
          const refreshed = await load();
          setError(null);
          if (refreshed) {
            setNotice("Regjistri u rifreskua pas një check-in. Rishiko dhe ruaj korrigjimin me arsye.");
          }
          return false;
        }
        throw new Error((body as ErrorBody).error?.message ?? "Regjistrimi nuk mund të ruhet.");
      }
      const saved = body as { id?: string; status?: AttendanceStatus };
      setData((current) => current ? {
        ...current,
        records: current.records.map((item) => item.rosterId === record.rosterId
          ? { ...item, id: saved.id ?? item.id, status: saved.status ?? status }
          : item),
      } : current);
      setError(null);
      return true;
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : "Ndodhi një gabim.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error && !loadError) {
    return <p role="status">Duke ngarkuar sesionin…</p>;
  }

  return (
    <section className="admin-section session-admin" aria-labelledby="session-admin-title">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Sesioni privat</p>
          <h2 id="session-admin-title">{data?.session.title ?? "Menaxhimi i sesionit"}</h2>
          {data ? (
            <p>Java {data.session.weekNumber} · {data.session.groupName} · {data.session.state}</p>
          ) : null}
        </div>
        <a className="admin-link" href={`/staff/project/${sessionId}`} target="_blank" rel="noreferrer">
          Hap projektorin
        </a>
      </div>

      {data && (data.session.state === "draft" || data.session.state === "open") ? (
        <div className="session-actions">
          <label htmlFor={`session-reason-${sessionId}`}>Arsyeja e ndryshimit</label>
          <input
            id={`session-reason-${sessionId}`}
            value={stateReason}
            onChange={(event) => setStateReason(event.target.value)}
            maxLength={500}
          />
          {data.session.state === "draft" ? (
            <button disabled={busy} type="button" onClick={() => void transition("open")}>Hap check-in</button>
          ) : (
            <button disabled={busy} type="button" onClick={() => void transition("closed")}>Mbyll check-in</button>
          )}
          <button className="secondary-action" disabled={busy} type="button" onClick={() => void transition("cancelled")}>Anulo sesionin</button>
        </div>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}
      {loadError ? <p role="alert">{loadError}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {data ? (
        <div className="private-records" role="table" aria-label="Regjistri privat i sesionit">
          <div className="private-record-header" role="row">
            <span>Studenti</span><span>Student ID</span><span>GitHub</span><span>Vijueshmëria</span>
          </div>
          {data.records.map((record) => (
            <RecordEditor key={record.rosterId} record={record} busy={busy} onSave={saveRecord} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RecordEditor({
  record,
  busy,
  onSave,
}: {
  record: PrivateRecord;
  busy: boolean;
  onSave: (record: PrivateRecord, status: AttendanceStatus, reason: string) => Promise<boolean>;
}) {
  const [editedStatus, setEditedStatus] = useState<AttendanceStatus | null>(null);
  const status = editedStatus ?? (record.status === "absent" ? "present" : record.status);
  const [reason, setReason] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onSave(record, status, reason)) {
      setEditedStatus(null);
      setReason("");
    }
  }

  return (
    <form className="private-record-row" role="row" onSubmit={submit}>
      <strong role="cell">{record.fullName}</strong>
      <span role="cell">{record.studentId}</span>
      <span role="cell">{record.githubUsername ? `@${record.githubUsername}` : "Pa lidhje"}</span>
      <div className="record-controls" role="cell">
        <span>{record.status === "absent" ? "Pa regjistrim" : statusLabels[record.status]}</span>
        <label className="sr-only" htmlFor={`status-${record.rosterId}`}>Statusi për {record.fullName}</label>
        <select
          id={`status-${record.rosterId}`}
          value={status}
          onChange={(event) => setEditedStatus(event.target.value as AttendanceStatus)}
        >
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="sr-only" htmlFor={`reason-${record.rosterId}`}>Arsyeja për {record.fullName}</label>
        <input
          id={`reason-${record.rosterId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={record.status === "absent" ? "Arsyeja e shtimit" : "Arsyeja e korrigjimit"}
          maxLength={500}
          required
        />
        <button disabled={busy} type="submit">Ruaj {record.fullName}</button>
      </div>
    </form>
  );
}
