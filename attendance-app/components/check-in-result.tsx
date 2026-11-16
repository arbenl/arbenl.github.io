"use client";

import { signIn } from "next-auth/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ClassroomLogin } from "./classroom-login";
import { ProfileForm } from "./profile-form";

const TOKEN_PATTERN = /^[0-9a-f]{64}$/u;
const STORAGE_KEY = "attendance-check-in";
const TOKEN_LIFETIME_MS = 5 * 60_000;
const checkInMessages:Record<string,string>={
  invalid_challenge:"QR-ja ka skaduar ose nuk është më aktive. Skano QR-në e re të profesorit.",
  checkin_closed:"Regjistrimi për këtë orë është mbyllur. Kontrollo vijueshmërinë tënde ose kërko ndihmën e profesorit.",
  semester_scope:"Profili i ruajtur i përket një semestri tjetër. Hape kartën për të ndërruar llogarinë ose kërko ndihmën e profesorit.",
};
function safeStorageRead(){try{return window.sessionStorage.getItem(STORAGE_KEY);}catch{return null;}}
function safeStorageClear(){try{window.sessionStorage.removeItem(STORAGE_KEY);}catch{/* Private browsers may block storage. */}}
function safeStorageWrite(value:unknown){try{window.sessionStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{/* In-memory QR login still works. */}}


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
  | { phase: "auth"; token: string }
  | { phase: "activation"; token: string; registrationPermit?: string }
  | { phase: "success"; result: CheckInSuccess }
  | { phase: "error"; message: string; retryable?: boolean };

function validToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

function readStoredToken(now: number): HeldToken | null {
  const raw = safeStorageRead();
  safeStorageClear();
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
    function capture(initial = false) {
      const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (!initial && !validToken(fragmentToken)) return;
      const now = Date.now();
      const storedToken = readStoredToken(now);
      window.history.replaceState(null, "", window.location.pathname);
      heldToken.current = validToken(fragmentToken)
        ? { token: fragmentToken, capturedAt: now }
        : storedToken;
      if (!heldToken.current) {
        setView({ phase: "missing" });
        return;
      }
      setAttempt(current => current + 1);
    }
    if (!initialized.current) {
      initialized.current = true;
      capture(true);
    }
    // Camera links can reuse this tab and change only its fragment.
    const rescan = () => capture();
    window.addEventListener("hashchange", rescan);
    return () => window.removeEventListener("hashchange", rescan);
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
    const capturedToken = heldToken.current;
    const currentToken = capturedToken.token;
    setView({ phase: "pending" });

    void fetch("/api/check-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: currentToken }),
    })
      .then(async (response) => {
        const body = (await response.json()) as ApiError | CheckInSuccess;
        if (heldToken.current !== capturedToken) return;
        if (response.ok) {
          heldToken.current = null;
          safeStorageClear();
          setView({ phase: "success", result: body as CheckInSuccess });
          return;
        }
        const error = body as ApiError;
        if (response.status === 401) {
          safeStorageWrite(heldToken.current);
          setView({ phase: "auth", token: currentToken });
          return;
        }
        if (error.error?.code === "roster_not_activated") {
          safeStorageWrite(heldToken.current);
          setView({ phase: "activation", token: currentToken, registrationPermit: error.error.registrationPermit });
          return;
        }
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable) safeStorageWrite(heldToken.current);
        if (!retryable) {
          heldToken.current = null;
          safeStorageClear();
        }
        setView({
          phase: "error",
          message: retryable ? "Shërbimi është i ngarkuar. Prit pak dhe provo sërish me të njëjtin kod." : checkInMessages[error.error?.code ?? ""] ?? error.error?.message ?? "Check-in-i dështoi.",
          retryable,
        });
      })
      .catch(() => {
        if (heldToken.current !== capturedToken) return;
        safeStorageWrite(heldToken.current);
        setView({ phase: "error", message: "Lidhja dështoi. Provo sërish me të njëjtin kod.", retryable: true });
      });
  }, [attempt]);

  async function beginLogin() {
    if (!heldToken.current) {
      setView({ phase: "missing" });
      return;
    }
    safeStorageWrite(heldToken.current);
    try { await signIn("github", { callbackUrl: "/check-in" }); }
    catch { setView({phase:"error",message:"Hyrja nuk filloi. Kontrollo lidhjen dhe provo përsëri.",retryable:true}); }
  }

  function resumeAfterActivation() {
    const token = heldToken.current;
    if (
      !token ||
      token.capturedAt > Date.now() ||
      Date.now() - token.capturedAt > TOKEN_LIFETIME_MS
    ) {
      heldToken.current = null;
      safeStorageClear();
      setView({ phase: "error", message: "Profili u ruajt. Për vijueshmërinë skano përsëri QR-në e re." });
      return;
    }
    setAttempt((current) => current + 1);
  }

  if (view.phase === "capturing" || view.phase === "pending") {
    return <p role="status">Duke konfirmuar vijueshmërinë…</p>;
  }
  if (view.phase === "missing") {
    return <div><p role="alert">Skano QR-në aktive të profesorit për ta konfirmuar vijueshmërinë.</p><p><a href="/student">Hap vijueshmërinë time</a></p></div>;
  }
  if (view.phase === "auth") {
    return (
      <div className="student-stack">
        <ClassroomLogin token={view.token} onAuthenticated={() => setAttempt((current) => current + 1)} />
        <p>Nëse përdor tashmë GitHub për vijueshmërinë, mund të hysh me të njëjtën llogari.</p>
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
    ) : null}<p><a href="/student">Hap vijueshmërinë time</a></p></div>;
  }

  return (
    <div className="check-in-success" role="status">
      <span aria-hidden="true" className="success-mark">✓</span>
      <h2>Vijueshmëria u konfirmua</h2><p><a className="admin-link" href="/progress">Hap kartën time →</a></p>
      <p>{view.result.sessionTitle}</p>
      <p>
        {view.result.duplicate ? "Check-in-i ishte regjistruar më parë." : "Check-in-i u regjistrua."}
      </p>
    </div>
  );
}
