import { colloquiumRoute } from '@/lib/colloquium/http';
import { staffState, openLobby } from '@/lib/colloquium/service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return colloquiumRoute(request, false, session => staffState(session));
}
export async function POST(request: Request) {
  return colloquiumRoute(request, true, async (session) => openLobby(session, await request.json()));
}
