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
}

export function ProfileForm({
  onActivated,
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

    try {
      const response = await fetch("/api/roster/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          semesterId: form.get("semesterId"),
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          studentId: form.get("studentId"),
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
        Zgjidh semestrin dhe shkruaj të dhënat saktësisht si në regjistrin zyrtar.
      </p>
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
      </select>

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

      {message ? <p role="alert">{message}</p> : null}
      {loadState === "error" ? null : (
        <button className="student-control primary-action" disabled={submitting} type="submit">
          {submitting ? "Duke aktivizuar…" : "Aktivizo profilin"}
        </button>
      )}
    </form>
  );
}
