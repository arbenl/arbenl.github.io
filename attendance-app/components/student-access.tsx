"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
export function SwitchAccount({
  callbackUrl = "/progress",
}: { callbackUrl?: string } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await signOut({ callbackUrl });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" disabled={busy} onClick={() => void logout()}>
        {busy ? "Duke dalë…" : "Dil / Ndërro llogarinë"}
      </button>
      {error && (
        <p role="alert">
          Dalja nuk përfundoi. Llogaria aktuale mbetet e hapur; kontrollo
          lidhjen dhe provo përsëri.
        </p>
      )}
    </>
  );
}
