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
          <p className="eyebrow">Vetëm për staf</p>
          <h1 id="staff-access-title">Staff access required</h1>
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
        <p className="eyebrow">Vetëm për staf</p>
        <h1>Paneli i vijueshmërisë</h1>
        <p>Krijo semestrat dhe sesionet, menaxho regjistrin dhe ruaj çdo ndryshim me arsye.</p>
      </header>
      <SemesterAdmin key={sessionId} initialSessionId={sessionId} />
    </main>
  );
}
