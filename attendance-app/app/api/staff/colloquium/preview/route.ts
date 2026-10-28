import { z } from 'zod';
import { AuthorizationError, getCurrentSession, requireStaff } from '../../../../../lib/auth/session';
import { requireColloquiumOrigin } from '../../../../../lib/colloquium/http';
import { ColloquiumError } from '../../../../../lib/colloquium/service';
import { gradePreview, PreviewError, startPreview } from '../../../../../lib/colloquium/preview';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), studentId: z.unknown() }).strict(),
  z.object({ action: z.literal('grade'), proof: z.unknown(), answers: z.unknown() }).strict(),
]);
async function readInput(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new PreviewError(400, 'invalid_request');
  const decoder = new TextDecoder();
  let bytes = 0; let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 24000) { await reader.cancel(); throw new PreviewError(413, 'invalid_request'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    requireColloquiumOrigin(request);
    const staff = await requireStaff(await getCurrentSession());
    const parsed = inputSchema.safeParse(await readInput(request));
    if (!parsed.success) throw new PreviewError(400, 'invalid_request');
    const input = parsed.data;
    const response = input.action === 'start' ? startPreview(staff.userId, input.studentId) : gradePreview(staff.userId, input.proof, input.answers);
    return Response.json(response, { headers });
  } catch (error) {
    const status = error instanceof PreviewError || error instanceof ColloquiumError || error instanceof AuthorizationError ? error.status : error instanceof SyntaxError ? 400 : 500;
    const code = error instanceof PreviewError || error instanceof ColloquiumError ? error.code : error instanceof AuthorizationError ? 'staff_required' : status === 400 ? 'invalid_request' : 'internal_error';
    return Response.json({ error: { code, message: code } }, { status, headers });
  }
}
