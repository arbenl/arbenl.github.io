import { colloquiumRoute } from '@/lib/colloquium/http';
import { startRoom } from '@/lib/colloquium/service';
export async function POST(request: Request, context: {
  params: Promise<{
    roomId: string;
  }>;
}) {
  return colloquiumRoute(request, true, async (session) => startRoom(session, (await context.params).roomId));
}
