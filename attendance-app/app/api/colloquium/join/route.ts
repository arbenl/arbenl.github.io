import { colloquiumRoute } from '@/lib/colloquium/http';
import { joinRoom } from '@/lib/colloquium/service';
export async function POST(request: Request) {
  return colloquiumRoute(request, true, async (session) => joinRoom(session, await request.json()));
}
