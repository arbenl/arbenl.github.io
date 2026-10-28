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
  beforeClass?: boolean;
}

export function ProfileForm({
  onActivated,
  token,
  registrationPermit,
  beforeClass = false,
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
  const [existingProfile, setExistingProfile] = useState<{ fullName: string; groupName: string; email: string } | null>(null);

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
        if (beforeClass) {
          // Failure to read an existing profile must not block first registration.
          try {
            const historyResponse = await fetch("/api/student/history", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]) });
            if (historyResponse.ok) {
              const history = await historyResponse.json() as { profile?: { fullName: string; groupName: string; email: string | null } | null };
              if (history.profile?.email) setExistingProfile({ ...history.profile, email: history.profile.email });
            }
          } catch {
            if (controller.signal.aborted) return;
          }
        }
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
  }, [beforeClass]);

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
          email: form.get("email"),
          groupName: form.get("groupName"),
          token,
          registrationPermit,
          beforeClass,
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
        <p>Për regjistrimin e parë pa GitHub, skano QR-në aktive të profesorit gjatë orës dhe plotëso të dhënat me emailin e fakultetit ose privat. Nëse përdor tashmë GitHub, mund të hysh këtu me të njëjtën llogari.</p>
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

  if (existingProfile) {
    return <div className="student-stack">
      <p role="status">Profili yt është regjistruar. Nuk ke nevojë ta plotësosh përsëri.</p>
      <p><strong>{existingProfile.fullName}</strong> · {existingProfile.groupName}</p>
      <a className="admin-link" href="/student">Hap vijueshmërinë time</a>
      <p>Në klasë skano QR-në në këtë shfletues.</p>
    </div>;
  }
  if (completed && !onActivated) {
    return <div className="student-stack"><p role="status">Profili u aktivizua. Tani mund ta skanosh QR-në.</p><a className="admin-link" href="/student">Hap vijueshmërinë time</a></div>;
  }

  return (
    <form aria-label="Aktivizo profilin" className="student-form" onSubmit={submit}>
      <p className="form-guidance">
        Regjistrohu vetëm një herë me emrin, mbiemrin dhe indeksin e saktë. Në orët e tjera mjafton të skanosh QR-në në shfletuesin ku ke hyrë.
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
        <option value="G2">Grupi 2 · 18:15</option>
      </select>
      <p className="form-guidance">Zgjidh grupin tënd të zakonshëm. Nëse ndërron orarin, mund të skanosh edhe QR-në e grupit tjetër; profili yt mbetet i njëjtë.</p>
      <label htmlFor="email">Emaili i fakultetit ose emaili privat</label>
      <input id="email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} aria-describedby="email-help" maxLength={254} className="student-control" required disabled={submitting} />
      <p id="email-help" className="form-guidance">Pranohet emaili yt i fakultetit, Gmail, Outlook ose një adresë tjetër private. Emaili mund të ndryshojë nga ai i llogarisë GitHub. Kontrolloje para ruajtjes; emaili ruhet privatisht.</p>
      {message ? <p role="alert">{message}</p> : null}
      {loadState === "error" ? <button className="student-control" type="button" onClick={() => window.location.reload()}>Provo përsëri</button> : (
        <button className="student-control primary-action" disabled={submitting || loadState !== "ready" || !semesters.length} type="submit">
          {submitting ? "Duke aktivizuar…" : "Aktivizo profilin"}
        </button>
      )}
    </form>
  );
}
