"use client";
import { useEffect, useRef, useState } from "react";
import { LiveProjector } from "./live-projector";
export function CourseLauncher({ week, kind, group }: { week: number; kind: "lecture" | "lab"; group?: "G1" | "G2" }) {
  const started = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void fetch("/api/course/launch", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ week, kind, group }),
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "QR-ja nuk mund të hapet.");
      setSessionId(body.sessionId);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Lidhja dështoi."));
  }, [week, kind, group]);
  if (sessionId) return <LiveProjector sessionId={sessionId} />;
  return <main className="page-shell"><section className="status-card">
    <h1>Java {week} · {kind === "lecture" ? "Ligjëratë" : `Ushtrime · ${group}`}</h1>
    {error ? <><p role="alert">{error}</p><button onClick={() => window.location.reload()}>Provo përsëri</button></>
      : <p role="status">Duke hapur QR-në për këtë orë…</p>}
    <p><a href="/staff">Kthehu te paneli</a></p>
  </section></main>;
}
