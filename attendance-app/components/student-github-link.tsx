"use client";
import { useEffect, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
export function StudentGitHubLink() {
  const [profile, setProfile] = useState<{
      githubLogin: string | null;
      repository: string | null;
    } | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState("");
  useEffect(() => {
    const c = new AbortController();
    void fetch("/api/student/github-link", {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const p = await r.json();
        setProfile(p);
        setUrl(p.repository ?? "");
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setMessage(
            "Lidhja me GitHub nuk mund të ngarkohet tani. Provo përsëri.",
          );
      });
    return () => c.abort();
  }, []);
  async function link() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/student/github-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!r.ok) throw new Error();
      await signIn("github", { callbackUrl: "/progress?github=linked" });
    } catch {
      setMessage("Lidhja nuk filloi. Provo përsëri.");
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/student/github-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "repository", url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setProfile((p) => (p ? { ...p, repository: d.repository } : p));
      setMessage("Repository u verifikua dhe u ruajt.");
    } catch {
      setMessage(
        "Repository nuk u verifikua. Përdor një repository publik, origjinal, në pronësi të GitHub-it tënd të konfirmuar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="admin-section" open={profile?.githubLogin === null}>
      <summary>Lidh GitHub-in dhe repository-n tim</summary>
      <p>
        {profile
          ? profile.githubLogin
            ? `Llogaria aktuale: ${profile.githubLogin}`
            : "Profili yt nuk ka ende llogari GitHub."
          : "Duke kontrolluar lidhjen…"}
      </p>
      <p>
        1. Në GitHub zgjidh llogarinë me të cilën dorëzon detyrat. 2. Shtyp
        butonin dhe konfirmoje. Karta, pjesëmarrja dhe testi ruhen në profilin
        ekzistues.
      </p>
      <button type="button" disabled={busy || !profile} onClick={link}>
        {busy
          ? "Duke punuar…"
          : profile?.githubLogin
            ? "Konfirmo / Ndrysho GitHub-in tim"
            : "Lidh GitHub-in tim"}
      </button>
      <p>
        Nëse llogaria i përket një profili tjetër, lidhja refuzohet. Dorëzimet e
        llogarisë së konfirmuar njihen brenda 5 minutave.
      </p>
      {profile?.githubLogin && (
        <form className="student-form" onSubmit={save}>
          {profile.repository && (
            <p>
              <a href={profile.repository}>Hap repository-n e verifikuar →</a>
            </p>
          )}
          <label htmlFor="student-repo-url">Repository i punës</label>
          <input
            className="student-control"
            id="student-repo-url"
            type="url"
            placeholder="https://github.com/llogaria/rideshare"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <button disabled={busy}>Verifiko dhe ruaj repository-n</button>
          <p>
            Ruajtja e këtij linku nuk krijon dorëzim. Për çdo javë përdor
            formularin e lëndës.
          </p>
          <a href="https://arbenl.github.io/lendet/2026-2027/mobile/dorezimet.html">
            Si dorëzoj? · 3 hapa
          </a>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
