"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
interface SignInProps {
  callbackUrl?: string;
}
export function SignIn({ callbackUrl = "/student" }: SignInProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function login() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const result = await signIn("github", { callbackUrl });
      if (result?.error) throw new Error("signin_failed");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="student-control primary-action"
        disabled={busy}
        onClick={() => void login()}
      >
        {busy ? "Duke hapur GitHub-in…" : "Hyr me GitHub"}
      </button>
      {error && (
        <p role="alert">
          Hyrja nuk filloi. Kontrollo lidhjen dhe provo përsëri me butonin më
          sipër.
        </p>
      )}
    </>
  );
}
