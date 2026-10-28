import { getCurrentSession } from '../auth/session';
import { AuthorizationError } from '../auth/session';
import { getEnv } from '../env';
import { ColloquiumError } from './service';
export function requireColloquiumOrigin(request: Request) {
  const expected = new URL(getEnv().NEXTAUTH_URL);
  // Next.js can reconstruct request.url with an internal localhost host.
  // Validate the external browser origin and Host against configured authority.
  if (request.headers.get('origin') !== expected.origin || request.headers.get('host') !== expected.host)
    throw new ColloquiumError(403, 'invalid_origin');
}
export async function colloquiumRoute(request: Request, mutating: boolean, action: (session: Awaited<ReturnType<typeof getCurrentSession>>) => Promise<unknown>) {
  try {
    if (mutating)
      requireColloquiumOrigin(request);
    const response = await action(await getCurrentSession());
    return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
  }
  catch (error) {
    const status = error instanceof ColloquiumError || error instanceof AuthorizationError ? error.status : error instanceof SyntaxError ? 400 : 500;
    const code = error instanceof ColloquiumError ? error.code : error instanceof AuthorizationError ? 'staff_required' : status === 400 ? 'invalid_request' : 'internal_error';
    return Response.json({ error: { code, message: code } }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
