import { colloquiumRoute } from '@/lib/colloquium/http';
import { results } from '@/lib/colloquium/service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return colloquiumRoute(request, false, session => results(session));
}
