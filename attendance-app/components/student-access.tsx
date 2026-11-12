"use client";
import { useState, type FormEvent } from "react";
import { signIn, signOut } from "next-auth/react";
export function StudentAccessLogin() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await signIn("student-access", {
        redirect: false,
        email: String(data.get("email")),
        code: String(data.get("code")),
      });
      if (r?.ok && !r.error) window.location.href = "/progress";
      else
        setError(
          "Emaili ose kodi nuk përputhen. Përdor emailin e regjistrimit dhe kodin personal.",
        );
    } catch {
      setError("Lidhja dështoi. Provo përsëri.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="student-form" onSubmit={submit}>
      <h2>Ke profil? Hyr nga çdo pajisje</h2>
      <p>
        Përdor emailin e regjistrimit dhe kodin personal që merr nga karta jote
        te “Hyr nga pajisje tjetër”. Profili dhe pjesëmarrja mbeten të njëjta.
      </p>
      <label htmlFor="access-email">Emaili i regjistrimit</label>
      <input
        className="student-control"
        id="access-email"
        name="email"
        type="email"
        autoComplete="username"
        required
      />
      <label htmlFor="access-code">Kodi personal</label>
      <input
        className="student-control"
        id="access-code"
        name="code"
        type="password"
        autoComplete="current-password"
        required
        minLength={20}
        maxLength={30}
      />
      {error && <p role="alert">{error}</p>}
      <button className="student-control" disabled={busy}>
        {busy ? "Duke hyrë…" : "Hyr në kartën time"}
      </button>
      <p>
        Nëse nuk e ke kodin, hape kartën në pajisjen ku je i kyçur. Nëse e ke
        humbur hyrjen, kërko ndihmën e profesorit ose identifikohu përsëri me QR
        gjatë orës; përdor të dhënat e njëjta që të rikthehet profili ekzistues.
      </p>
    </form>
  );
}
export function StudentAccessCode() {
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/student/access-code", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setCode(d.code);
    } catch {
      setError("Kodi nuk mund të krijohet tani. Provo përsëri.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="admin-section">
      <summary>Hyr nga pajisje tjetër</summary>
      <p>
        Krijo kodin personal dhe ruaje privatisht. Në pajisjen tjetër hap
        /progress, shkruaj emailin e regjistrimit dhe këtë kod. Nuk krijohet
        profil i ri dhe hyrja nuk regjistron pjesëmarrje.
      </p>
      <button disabled={busy} onClick={create}>
        {code
          ? "Krijo kod të ri (kodi i vjetër çaktivizohet)"
          : "Krijo kodin tim personal"}
      </button>
      {code && (
        <p role="status">
          <strong>
            Kodi personal: <code>{code}</code>
          </strong>
          <br />
          Shfaqet vetëm tani. Ruaje para se ta mbyllësh faqen.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
export function SwitchAccount() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/progress" })}
    >
      Dil / Ndërro llogarinë
    </button>
  );
}
