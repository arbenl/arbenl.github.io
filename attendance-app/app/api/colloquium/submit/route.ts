import { colloquiumRoute } from '@/lib/colloquium/http';
import { submitAttempt } from '@/lib/colloquium/service';
export async function POST(request: Request) {
  return colloquiumRoute(request, true, async (session) => submitAttempt(session, await request.json()));
}
