import Link from 'next/link';
import { ColloquiumStaff } from '../../../components/colloquium/staff';
import { requireCurrentStaff } from '../../../lib/auth/session';
export const dynamic = 'force-dynamic';
export default async function ColloquiumStaffPage() {
  try { await requireCurrentStaff(); }
  catch { return <main className="cq-shell"><section className="cq-panel"><h1>Hyrja e profesorit</h1><p>Paneli i kolokviumit kërkon llogarinë e autorizuar të profesorit.</p><Link href="/api/auth/signin?callbackUrl=/staff/colloquium">Hyr në panel</Link></section></main>; }
  return <ColloquiumStaff />;
}
