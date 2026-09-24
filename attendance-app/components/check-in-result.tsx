"use client";

import { signIn } from "next-auth/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ProfileForm } from "./profile-form";

const TOKEN_PATTERN = /^[0-9a-f]{64}$/u;
const STORAGE_KEY = "attendance-check-in";
const TOKEN_LIFETIME_MS = 120_000;

interface HeldToken {
  token: string;
  capturedAt: number;
}

interface ApiError {
  error?: { code?: string; message?: string; registrationPermit?: string };
}

interface CheckInSuccess {
  sessionTitle: string;
  status: string;
  recordedAt: string;
  duplicate: boolean;
}

type ViewState =
  | { phase: "capturing" }
  | { phase: "pending" }
  | { phase: "missing" }
  | { phase: "auth" }
  | { phase: "activation"; token: string; registrationPermit?: string }
  | { phase: "success"; result: CheckInSuccess }
  | { phase: "error"; message: string; retryable?: boolean };

function validToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

function readStoredToken(now: number): HeldToken | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  window.sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const candidate = JSON.parse(raw) as Partial<HeldToken>;
    if (
      validToken(candidate.token) &&
      typeof candidate.capturedAt === "number" &&
      candidate.capturedAt <= now &&
      now - candidate.capturedAt <= TOKEN_LIFETIME_MS
    ) {
      return { token: candidate.token, capturedAt: candidate.capturedAt };
    }
  } catch {
    // Invalid same-tab handoff values are discarded.
  }
  return null;
}

export function CheckInResult() {
  const heldToken = useRef<HeldToken | null>(null);
  const initialized = useRef(false);
  const submittedAttempt = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ViewState>({ phase: "capturing" });

  useLayoutEffect(() => {
    if (initialized.current) {
      return;
    }
    initialized.current = true;
    const now = Date.now();
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const fragmentToken = fragment.get("token");
    const storedToken = readStoredToken(now);

    window.history.replaceState(null, "", window.location.pathname);
    heldToken.current = validToken(fragmentToken)
      ? { token: fragmentToken, capturedAt: now }
      : storedToken;

    if (!heldToken.current) {
      setView({ phase: "missing" });
      return;
    }
    setAttempt(1);
  }, []);

  useEffect(() => {
    if (
      attempt === 0 ||
      !heldToken.current ||
      submittedAttempt.current === attempt
    ) {
      return;
    }
    submittedAttempt.current = attempt;
    const currentToken = heldToken.current.token;
    setView({ phase: "pending" });

    void fetch("/api/check-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: currentToken }),
    })
      .then(async (response) => {
        const body = (await response.json()) as ApiError | CheckInSuccess;
        if (response.ok) {
          heldToken.current = null;
          window.sessionStorage.removeItem(STORAGE_KEY);
          setView({ phase: "success", result: body as CheckInSuccess });
          return;
        }
        const error = body as ApiError;
        if (response.status === 401) {
          setView({ phase: "auth" });
          return;
        }
        if (error.error?.code === "roster_not_activated") {
          setView({ phase: "activation", token: currentToken, registrationPermit: error.error.registrationPermit });
          return;
        }
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable) {
          heldToken.current = null;
          window.sessionStorage.removeItem(STORAGE_KEY);
        }
        setView({
          phase: "error",
          message: retryable ? "Shërbimi është i ngarkuar. Prit pak dhe provo sërish me të njëjtin kod." : error.error?.message ?? "Check-in-i dështoi.",
          retryable,
        });
      })
      .catch(() => {
        setView({ phase: "error", message: "Lidhja dështoi. Provo sërish me të njëjtin kod.", retryable: true });
      });
  }, [attempt]);

  function beginLogin() {
    if (!heldToken.current) {
      setView({ phase: "missing" });
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(heldToken.current));
    void signIn("github", { callbackUrl: "/check-in" });
  }

  function resumeAfterActivation() {
    const token = heldToken.current;
    if (
      !token ||
      token.capturedAt > Date.now() ||
      Date.now() - token.capturedAt > TOKEN_LIFETIME_MS
    ) {
      heldToken.current = null;
      window.sessionStorage.removeItem(STORAGE_KEY);
      setView({ phase: "error", message: "Profili u ruajt. Për vijueshmërinë skano përsëri QR-në e re." });
      return;
    }
    setAttempt((current) => current + 1);
  }

  if (view.phase === "capturing" || view.phase === "pending") {
    return <p role="status">Duke konfirmuar vijueshmërinë…</p>;
  }
  if (view.phase === "missing") {
    return <p role="alert">Nuk ka token të vlefshëm. Skano QR-në e projektuar.</p>;
  }
  if (view.phase === "auth") {
    return (
      <div className="student-stack">
        <p>Hyr me GitHub për ta përfunduar check-in-in.</p>
        <button className="student-control primary-action" onClick={beginLogin} type="button">
          Hyr me GitHub
        </button>
      </div>
    );
  }
  if (view.phase === "activation") {
    return (
      <div className="student-stack">
        <h2>Aktivizo profilin</h2>
        <ProfileForm
          registrationPermit={view.registrationPermit}
          token={view.token}
          callbackUrl="/check-in"
          onActivated={resumeAfterActivation}
          onAuthenticationRequired={beginLogin}
        />
      </div>
    );
  }
  if (view.phase === "error") {
    return <div className="student-stack"><p role="alert">{view.message}</p>{view.retryable ? (
      <button className="student-control primary-action" onClick={() => setAttempt((current) => current + 1)} type="button">Provo sërish</button>
    ) : null}</div>;
  }

  return (
    <div className="check-in-success" role="status">
      <span aria-hidden="true" className="success-mark">✓</span>
      <h2>Vijueshmëria u konfirmua</h2>
      <p>{view.result.sessionTitle}</p>
      <p>
        {view.result.duplicate ? "Check-in-i ishte regjistruar më parë." : "Check-in-i u regjistrua."}
      </p>
    </div>
  );
}
