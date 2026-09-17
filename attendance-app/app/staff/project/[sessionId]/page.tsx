import Link from "next/link";

import { LiveProjector } from "../../../../components/live-projector";
import { requireCurrentStaff } from "../../../../lib/auth/session";

export default async function ProjectorPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  try {
    await requireCurrentStaff();
  } catch {
    return (
      <main className="page-shell" id="permbajtja-kryesore">
        <section className="status-card" aria-labelledby="projector-access-title">
          <p className="eyebrow">Vetëm për staf</p>
          <h1 id="projector-access-title">Staff access required</h1>
          <p>Hyr me llogarinë GitHub të autorizuar për ta hapur projektorin.</p>
          <Link className="admin-link" href={`/api/auth/signin?callbackUrl=/staff/project/${sessionId}`}>
            Hyr me GitHub
          </Link>
        </section>
      </main>
    );
  }
  return <LiveProjector sessionId={sessionId} />;
}
