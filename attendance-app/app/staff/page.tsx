import Link from "next/link";

import { SemesterAdmin } from "../../components/semester-admin";
import { requireCurrentStaff } from "../../lib/auth/session";

export const dynamic = "force-dynamic";

export default async function StaffPage({ searchParams }: {
  searchParams?: Promise<{ sessionId?: string | string[] }>;
} = {}) {
  try {
    await requireCurrentStaff();
  } catch {
    return (
      <main className="page-shell" id="permbajtja-kryesore">
        <section className="status-card" aria-labelledby="staff-access-title">
          <p className="eyebrow">Paneli i profesorit · 2026/2027</p>
          <h1 id="staff-access-title">Staff access required</h1>
          <p>Programimi për Pajisje Mobile · Semestri dimëror 2026/2027.</p>
          <p>Hyr me llogarinë GitHub të autorizuar për stafin.</p>
          <Link className="admin-link" href="/api/auth/signin?callbackUrl=/staff">Hyr me GitHub</Link>
        </section>
      </main>
    );
  }

  const params = await searchParams;
  const sessionId = typeof params?.sessionId === "string" ? params.sessionId : undefined;

  return (
    <main className="admin-shell" id="permbajtja-kryesore">
      <header className="admin-page-header">
        <p className="eyebrow">Paneli i profesorit · 2026/2027</p>
        <h1>Programimi për Pajisje Mobile</h1>
        <p><strong>Vijueshmëria · Semestri dimëror 2026/2027 · Kolegji AAB</strong></p>
        <a className="admin-link" href="https://arbenl.github.io/lendet/2026-2027/mobile/">← Materialet e lëndës</a>
        <p>Hap lidhjen e ligjëratës ose të ushtrimeve: QR-ja shfaqet automatikisht, pa zgjedhur semestër ose program.</p>
      </header>
      <SemesterAdmin key={sessionId} initialSessionId={sessionId} />
    </main>
  );
}
