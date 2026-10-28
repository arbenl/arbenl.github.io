"use client";

import { signIn } from "next-auth/react";
import { type FormEvent, useEffect, useState } from "react";

const registrationErrors: Record<string, string> = {
  invalid_qr: "QR-ja ka skaduar ose nuk është më aktive. Skano QR-në e re të profesorit.",
  profile_conflict: "Të dhënat nuk përputhen me profilin ekzistues. Kontrollo emrin, indeksin dhe emailin ose kërko ndihmën e profesorit.",
  invalid_registration: "Kontrollo emrin, mbiemrin, indeksin, grupin dhe emailin para se të provosh sërish.",
  staff_forbidden: "Kjo hyrje është vetëm për studentët. Profesori hyn nga faqja e mbrojtur me GitHub.",
  rate_limited: "Prit pak para se të provosh sërish. Nëse QR-ja skadon, skano QR-në e re të profesorit.",
  classroom_unavailable: "Regjistrimi me QR është përkohësisht i padisponueshëm. Kërko ndihmën e profesorit.",
};

interface ClassroomLoginProps {
  token: string;
  onAuthenticated: () => void;
}

export function ClassroomLogin({ token, onAuthenticated }: ClassroomLoginProps) {
  const [readiness, setReadiness] = useState<"loading" | "ready" | "unavailable">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/classroom/status", { cache: "no-store" })
      .then(async (response) => {
        const body = response.ok ? await response.json() as { enabled?: boolean } : null;
        if (active) setReadiness(body?.enabled === true ? "ready" : "unavailable");
      })
      .catch(() => { if (active) setReadiness("unavailable"); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await signIn("classroom", {
        redirect: false,
        token,
        email: String(data.get("email") ?? "").trim(),
        firstName: String(data.get("firstName") ?? "").trim(),
        lastName: String(data.get("lastName") ?? "").trim(),
        studentId: String(data.get("studentId") ?? "").trim(),
        groupName: String(data.get("groupName") ?? ""),
      });
      if (result?.ok && !result.error) {
        onAuthenticated();
      } else {
        setMessage(registrationErrors[result?.error ?? ""] ?? "Hyrja nuk u krye. QR-ja mund të ketë skaduar ose të dhënat nuk përputhen. Kontrollo të dhënat dhe skano QR-në e re të profesorit.");
      }
    } catch {
      setMessage("Lidhja dështoi. Provo sërish; nëse QR-ja ka skaduar, skano QR-në e re të profesorit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (readiness === "loading") return <p role="status">Duke kontrolluar regjistrimin me QR…</p>;
  if (readiness === "unavailable") return <p role="status">Regjistrimi me QR është përkohësisht i padisponueshëm. Mund të përdorësh GitHub ose të kërkosh ndihmën e profesorit.</p>;

  return <form aria-label="Regjistrohu me QR" className="student-form" onSubmit={submit}>
    <h2>Regjistrohu me QR</h2>
    <p className="form-guidance">Plotëso të dhënat gjatë orës me QR-në aktive të profesorit. Pranohet emaili i fakultetit ose privat; nuk duhet fjalëkalim apo kod emaili.</p>
    <label htmlFor="classroom-firstName">Emri</label>
    <input id="classroom-firstName" name="firstName" autoComplete="given-name" maxLength={100} className="student-control" required disabled={submitting} />
    <label htmlFor="classroom-lastName">Mbiemri</label>
    <input id="classroom-lastName" name="lastName" autoComplete="family-name" maxLength={100} className="student-control" required disabled={submitting} />
    <label htmlFor="classroom-studentId">Student ID</label>
    <input id="classroom-studentId" name="studentId" autoComplete="off" maxLength={100} className="student-control" required disabled={submitting} />
    <label htmlFor="classroom-groupName">Grupi i ushtrimeve</label>
    <select id="classroom-groupName" name="groupName" className="student-control" required disabled={submitting}>
      <option value="">Zgjidh grupin tënd</option>
      <option value="G1">Grupi 1 · 14:45</option>
      <option value="G2">Grupi 2 · 18:15</option>
    </select>
    <label htmlFor="classroom-email">Emaili i fakultetit ose emaili privat</label>
    <input id="classroom-email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} aria-describedby="classroom-email-help" className="student-control" required disabled={submitting} />
    <p id="classroom-email-help" className="form-guidance">Përdor emailin tënd dhe kontrolloje para ruajtjes. Profili ruhet për skanimet e ardhshme në këtë shfletues.</p>
    {message ? <p role="alert">{message}</p> : null}
    <button className="student-control primary-action" type="submit" disabled={submitting}>{submitting ? "Duke regjistruar…" : "Regjistrohu dhe konfirmo vijueshmërinë"}</button>
  </form>;
}
