"use client";

import { FormEvent, useEffect, useState } from "react";

import { SignIn } from "./sign-in";

interface SemesterOption {
  id: string;
  title: string;
}

interface ErrorBody {
  error?: { message?: string };
}

interface ProfileFormProps {
  onActivated?: () => void;
  onAuthenticationRequired?: () => void;
  callbackUrl?: string;
  token?: string;
  registrationPermit?: string;
}

export function ProfileForm({
  onActivated,
  token,
  registrationPermit,
  onAuthenticationRequired,
  callbackUrl = "/student/activate",
}: ProfileFormProps) {
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "auth" | "error">(
    "loading",
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/semesters", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setLoadState("auth");
          return;
        }
        if (!response.ok) {
          throw new Error("Semestrat nuk mund të ngarkohen.");
        }
        const body = (await response.json()) as SemesterOption[];
        setSemesters(body);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setMessage(error instanceof Error ? error.message : "Ndodhi një gabim.");
        setLoadState("error");
      });

    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    if (form.get("email")?.toString().trim().toLowerCase() !== form.get("emailConfirm")?.toString().trim().toLowerCase()) {
      setMessage("Dy adresat e emailit duhet të jenë të njëjta.");
      setSubmitting(false);
      return;
    }
    try {
      const response = await fetch("/api/roster/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          semesterId: form.get("semesterId"),
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          studentId: form.get("studentId"),
          email: form.get("email"),
          groupName: form.get("groupName"),
          token,
          registrationPermit,
        }),
      });
      const body = (await response.json()) as ErrorBody;
      if (response.status === 401) {
        setLoadState("auth");
        return;
      }
      if (!response.ok) {
        setMessage(body.error?.message ?? "Profili nuk mund të aktivizohet.");
        return;
      }

      setCompleted(true);
      onActivated?.();
    } catch {
      setMessage("Lidhja dështoi. Provo përsëri.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState === "auth") {
    return (
      <div className="student-stack">
        <p>Hyr me GitHub për ta lidhur profilin me regjistrin.</p>
        {onAuthenticationRequired ? (
          <button
            className="student-control primary-action"
            onClick={onAuthenticationRequired}
            type="button"
          >
            Hyr me GitHub
          </button>
        ) : (
          <SignIn callbackUrl={callbackUrl} />
        )}
      </div>
    );
  }

  if (completed && !onActivated) {
    return <p role="status">Profili u aktivizua. Tani mund ta skanosh QR-në.</p>;
  }

  return (
    <form aria-label="Aktivizo profilin" className="student-form" onSubmit={submit}>
      <p className="form-guidance">
        Regjistrohu vetëm një herë me emrin, mbiemrin dhe indeksin e saktë. Në orët e tjera mjafton të skanosh QR-në me të njëjtën llogari GitHub.
      </p>
      {semesters.length === 1 ? <input type="hidden" name="semesterId" value={semesters[0].id} /> : <>
      <label htmlFor="semesterId">Semestri</label>
      <select
        className="student-control"
        disabled={loadState !== "ready" || submitting}
        id="semesterId"
        name="semesterId"
        required
      >
        <option value="">Zgjidh semestrin</option>
        {semesters.map((semester) => (
          <option key={semester.id} value={semester.id}>
            {semester.title}
          </option>
        ))}
      </select></>}

      <label htmlFor="firstName">Emri</label>
      <input
        autoComplete="given-name"
        className="student-control"
        disabled={submitting}
        id="firstName"
        maxLength={100}
        name="firstName"
        required
      />

      <label htmlFor="lastName">Mbiemri</label>
      <input
        autoComplete="family-name"
        className="student-control"
        disabled={submitting}
        id="lastName"
        maxLength={100}
        name="lastName"
        required
      />

      <label htmlFor="studentId">Student ID</label>
      <input
        autoComplete="off"
        className="student-control"
        disabled={submitting}
        id="studentId"
        maxLength={100}
        name="studentId"
        required
      />

      <label htmlFor="groupName">Grupi i ushtrimeve</label>
      <select id="groupName" name="groupName" className="student-control" required disabled={submitting}>
        <option value="">Zgjidh grupin tënd</option>
        <option value="G1">Grupi 1 · 14:45</option>
        <option value="G2">Grupi 2 · 18:00</option>
      </select>
      <label htmlFor="email">Emaili që përdor për Google Drive</label>
      <input id="email" name="email" type="email" autoComplete="email" maxLength={254} className="student-control" required disabled={submitting} />
      <label htmlFor="emailConfirm">Shkruaje emailin përsëri</label>
      <input id="emailConfirm" name="emailConfirm" type="email" autoComplete="off" maxLength={254} className="student-control" required disabled={submitting} />
      <p className="form-guidance">Emaili ruhet privatisht për materialet e lëndës. Regjistrimi i tij nuk aktivizon vetvetiu qasjen në Drive.</p>
      {message ? <p role="alert">{message}</p> : null}
      {loadState === "error" ? null : (
        <button className="student-control primary-action" disabled={submitting || loadState !== "ready" || !semesters.length} type="submit">
          {submitting ? "Duke aktivizuar…" : "Aktivizo profilin"}
        </button>
      )}
    </form>
  );
}
