import { colloquiumRoute } from '@/lib/colloquium/http';
import { studentState } from '@/lib/colloquium/service';
export async function POST(request: Request) {
  return colloquiumRoute(request, true, async (session) => studentState(session, await request.json()));
}
