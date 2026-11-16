import { redirectProfessor } from "../lib/auth/role-entry";
export const dynamic = "force-dynamic";
export default async function Home() {
  await redirectProfessor();
  return (
    <main className="page-shell" id="permbajtja-kryesore">
      <section className="status-card" aria-labelledby="page-title">
        <p className="eyebrow">AAB · Vijueshmëria live</p>
        <h1 id="page-title">Çdo orë, një evidencë e qartë.</h1>
        <p>
          Skano QR-në që shfaqet në projektor. Herën e parë lidhe profilin me
          Student ID; në orët e tjera check-in përfundon menjëherë.
        </p>
        <div className="home-actions">
          <a className="primary-action" href="/progress">Jam student · Karta ime</a>
          <a className="primary-action" href="/staff">Jam profesor · Hap panelin</a>
          <a className="secondary-link" href="https://arbenl.github.io/lendet/2026-2027/mobile/">Kthehu te lënda</a>
        </div>
      </section>
    </main>
  );
}
