import Link from 'next/link';
import { ColloquiumPreview } from '../../../../components/colloquium/preview';
import { requireCurrentStaff } from '../../../../lib/auth/session';
export const dynamic = 'force-dynamic';
export default async function ColloquiumPreviewPage() {
  try { await requireCurrentStaff(); }
  catch { return <main className="cq-shell"><section className="cq-panel"><h1>Hyrja e profesorit</h1><p>Prova private kërkon llogarinë e autorizuar të profesorit.</p><Link href="/api/auth/signin?callbackUrl=/staff/colloquium/preview">Hyr në panel</Link></section></main>; }
  return <ColloquiumPreview />;
}
