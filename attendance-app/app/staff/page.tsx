import Link from "next/link";

import { StaffWorkspace } from "../../components/staff-workspace";
import { AuthorizationError, requireCurrentStaff } from "../../lib/auth/session";

export const dynamic = "force-dynamic";

export default async function StaffPage({ searchParams }: {
  searchParams?: Promise<{ sessionId?: string | string[] }>;
} = {}) {
  try {
    await requireCurrentStaff();
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
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
        <p>Orët, materialet dhe evidencat e lëndës.</p>
        <nav className="course-actions" aria-label="Veprimet e profesorit">
          <Link className="admin-link" href="#course-qr-title">Hap QR-në e orës</Link>
          <Link className="secondary-link" href="/progress">Regjistri i studentëve</Link>
          <Link className="secondary-link" href="/staff/report">Raporti sipas javëve</Link>
          <a className="secondary-link" href="https://arbenl.github.io/lendet/2026-2027/mobile/">Materialet e lëndës</a>
        </nav>
      </header>
      <StaffWorkspace initialNow={new Date().toISOString()} initialSessionId={sessionId} />
    </main>
  );
}
