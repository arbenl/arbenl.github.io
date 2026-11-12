"use client";
import { useState, type FormEvent } from "react";
export function StaffSubmissionAccount({ rosterId }: { rosterId: string }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const match = String(data.get("source"))
      .trim()
      .match(
        /^https:\/\/github\.com\/arbenl\/arbenl-mobile-assignments-2026-2027\/issues\/(\d+)$/,
      );
    if (!match) {
      setMessage("Vendos linkun e saktë të dorëzimit në lëndë.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/staff/submission-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rosterId,
          issue: Number(match[1]),
          reason: String(data.get("reason")),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(
        `U verifikua ${d.login}. Rifresko kartën për të parë dorëzimet.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Verifikimi dështoi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Vetëm profesori · Verifiko llogarinë e dorëzimeve</summary>
      <form className="student-form" onSubmit={submit}>
        <p>
          Konfirmo që ky dorëzim i përket studentit të zgjedhur. Ky veprim lidh
          vetëm evidencën e dorëzimeve; hyrja, pjesëmarrja dhe testi ruhen.
        </p>
        <label htmlFor="verified-issue">Linku i dorëzimit të verifikuar</label>
        <input
          id="verified-issue"
          name="source"
          type="url"
          className="student-control"
          required
        />
        <label htmlFor="verified-reason">Arsyeja e verifikimit</label>
        <input
          id="verified-reason"
          name="reason"
          minLength={8}
          maxLength={500}
          className="student-control"
          required
        />
        <button disabled={busy}>Verifiko dhe lidh dorëzimet</button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
