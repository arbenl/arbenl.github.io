import { ColloquiumStudent } from '../../components/colloquium/student';
import { redirect } from 'next/navigation';
import { AuthorizationError, requireCurrentStaff } from '../../lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function ColloquiumPage() {
  try {
    await requireCurrentStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return <ColloquiumStudent />;
    throw error;
  }
  redirect('/staff/colloquium');
}
