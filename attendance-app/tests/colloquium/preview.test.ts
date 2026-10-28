// @vitest-environment node
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ bank: Array.from({ length: 10 }, (_, i) => ({ id: `semantic-question-${i}`, prompt: `Synthetic question ${i}`, source: 'synthetic', correctOptionId: 'correct', options: [{ id: 'correct', text: 'Synthetic correct' }, { id: 'wrong-a', text: 'Synthetic A' }, { id: 'wrong-b', text: 'Synthetic B' }] })) }));
vi.mock('../../lib/colloquium/bank', () => ({ getQuestionBank: vi.fn(() => fixture.bank) }));
import { getQuestionBank } from '../../lib/colloquium/bank';
import { gradePreview, startPreview } from '../../lib/colloquium/preview';
const now = new Date('2026-10-28T10:00:00Z');
beforeEach(() => { process.env.NEXTAUTH_SECRET = 'synthetic-preview-secret'; vi.mocked(getQuestionBank).mockReset().mockReturnValue(fixture.bank); });
it('accepts arbitrary trial labels, gives 600 seconds and exposes only opaque public IDs', () => {
 const run = startPreview('staff-one', ' GABIM ', now);
 expect(run).toMatchObject({ private: true, studentId: 'GABIM', serverTime: now.toISOString(), deadline: '2026-10-28T10:10:00.000Z' });
 expect(run.questions).toHaveLength(10);
 expect(run.questions.every(q => !q.id.includes('semantic') && q.options.length === 3 && q.options.every(o => /^[a-f0-9-]{36}$/.test(o.id)))).toBe(true);
 expect(JSON.stringify(run)).not.toContain('semantic-question');
 expect(JSON.stringify(run)).not.toContain('correctOptionId');
 expect(Buffer.from(run.proof, 'base64url').toString()).not.toContain('semantic-question');
 const again = startPreview('staff-one', 'GABIM', now);
 expect(again.proof).not.toBe(run.proof);
 expect(again.questions.map(q => q.id)).not.toEqual(run.questions.map(q => q.id));
});
it('grades real shuffled choices without leaking the key and accepts post-deadline advisory grading', () => {
 const run = startPreview('staff-one', 'GABIM', now);
 const answers = Object.fromEntries(run.questions.map(q => [q.id, q.options.find(o => o.text === 'Synthetic correct')!.id]));
 expect(gradePreview('staff-one', run.proof, answers, new Date(now.getTime() + 601000))).toEqual({ private: true, studentId: 'GABIM', score: 10, maxScore: 10 });
 expect(gradePreview('staff-one', run.proof, {}, now).score).toBe(0);
});
it('rejects tampering, wrong staff, expired proof, and future proof', () => {
 const run = startPreview('staff-one', 'GABIM', now);
 const damaged = Buffer.from(run.proof, 'base64url'); damaged[15] ^= 1;
 for (const [staff, proof, time] of [['staff-two', run.proof, now], ['staff-one', damaged.toString('base64url'), now], ['staff-one', run.proof, new Date(now.getTime() + 3600001)], ['staff-one', run.proof, new Date(now.getTime() - 1)]] as const) {
  expect(() => gradePreview(staff, proof, {}, time)).toThrow('invalid_preview_proof');
 }
});
it('rejects purpose/version/bank mismatches even when encrypted with the preview key', () => {
 const run = startPreview('staff-one', 'GABIM', now);
 // Known synthetic secret permits testing authenticated malformed payloads; no actual key or bank is used.
 const key = createHmac('sha256', process.env.NEXTAUTH_SECRET!).update('colloquium-private-preview:v1').digest();
 const bytes = Buffer.from(run.proof, 'base64url');
 const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
 decipher.setAAD(Buffer.from('colloquium-private-preview:v1'));
 decipher.setAuthTag(bytes.subarray(12, 28));
 const original = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
 for (const changes of [{ purpose: 'official' }, { version: 2 }, { bankVersion: 'unknown' }]) {
  const payload = { ...original, ...changes };
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from('colloquium-private-preview:v1'));
  const body = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  const proof = Buffer.concat([nonce, cipher.getAuthTag(), body]).toString('base64url');
  expect(() => gradePreview('staff-one', proof, {}, now)).toThrow('invalid_preview_proof');
 }
 expect(run.proof.length).toBeLessThanOrEqual(16000);
});
it('bounds labels, proof and answers; rejects unknown questions and options', () => {
 for (const label of ['', '  ', 'x'.repeat(101), 123]) expect(() => startPreview('staff-one', label, now)).toThrow('invalid_preview_index');
 const run = startPreview('staff-one', 'GABIM', now);
 for (const answers of [null, [], { unknown: 'x' }, { [run.questions[0].id]: 'correct' }, Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`q${i}`, null]))]) expect(() => gradePreview('staff-one', run.proof, answers, now)).toThrow('invalid_preview_answers');
 for (const proof of ['', 'x'.repeat(16001), null]) expect(() => gradePreview('staff-one', proof, {}, now)).toThrow('invalid_preview_proof');
});
it('fails closed when the bank or existing auth secret is unavailable', () => {
 const run = startPreview('staff-one', 'GABIM', now);
 vi.mocked(getQuestionBank).mockImplementation(() => { throw new Error('sensitive configuration'); });
 expect(() => startPreview('staff-one', 'GABIM', now)).toThrow('question_bank_unavailable');
 expect(() => gradePreview('staff-one', run.proof, {}, now)).toThrow('question_bank_unavailable');
 delete process.env.NEXTAUTH_SECRET;
 expect(() => startPreview('staff-one', 'GABIM', now)).toThrow();
});

const auth = vi.hoisted(() => ({ getCurrentSession: vi.fn(), directory: { findByGitHubId: vi.fn() } }));
vi.mock('../../lib/auth/session', async importOriginal => {
 const actual = await importOriginal<typeof import('../../lib/auth/session')>();
 return { ...actual, getCurrentSession: auth.getCurrentSession, requireStaff: (session: Parameters<typeof actual.requireStaff>[0]) => actual.requireStaff(session, auth.directory) };
});
vi.mock('../../lib/env', () => ({ getEnv: () => ({ NEXTAUTH_URL: 'https://preview.example.test', NEXTAUTH_SECRET: 'synthetic-preview-secret' }) }));
import { POST } from '../../app/api/staff/colloquium/preview/route';
function request(body: unknown, headers: Record<string, string> = {}) {
 return new Request('https://preview.example.test/api/staff/colloquium/preview', { method: 'POST', headers: { origin: 'https://preview.example.test', host: 'preview.example.test', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
function professor() {
 process.env.PROFESSOR_GITHUB_ID = '900000001';
 auth.getCurrentSession.mockResolvedValue({ user: { githubId: '900000001', githubLogin: 'professor' } });
 auth.directory.findByGitHubId.mockResolvedValue({ userId: 'staff-one', githubId: '900000001', githubLogin: 'professor', role: 'professor' });
}
it('requires verified professor access on every action including grading', async () => {
 professor();
 const start = await POST(request({ action: 'start', studentId: 'GABIM' }));
 expect(start.status).toBe(200);
 expect(start.headers.get('Cache-Control')).toBe('no-store');
 const run = await start.json();
 const graded = await POST(request({ action: 'grade', proof: run.proof, answers: {} }));
 expect(graded.status).toBe(200);
 expect(await graded.json()).toEqual({ private: true, studentId: 'GABIM', score: 0, maxScore: 10 });
 for (const session of [null, { user: { githubId: '900000002', githubLogin: 'student' } }]) {
  auth.getCurrentSession.mockResolvedValue(session);
  for (const body of [{ action: 'start', studentId: 'GABIM' }, { action: 'grade', proof: run.proof, answers: {} }]) expect((await POST(request(body))).status).toBe(session ? 403 : 401);
 }
 professor();
 auth.directory.findByGitHubId.mockResolvedValue(null);
 expect((await POST(request({ action: 'grade', proof: run.proof, answers: {} }))).status).toBe(403);
});
it('checks canonical Origin and Host, bounds request size, and safely reports bank failures', async () => {
 professor();
 for (const headers of [{ origin: 'https://attacker.test' }, { host: 'attacker.test' }] as Record<string, string>[]) expect((await POST(request({ action: 'start', studentId: 'GABIM' }, headers))).status).toBe(403);
 expect((await POST(request({ action: 'unknown' }))).status).toBe(400);
 expect((await POST(request({ action: 'start', studentId: 'GABIM', extra: true }))).status).toBe(400);
 expect((await POST(request({ action: 'start', studentId: 'x'.repeat(25000) }))).status).toBe(413);
 vi.mocked(getQuestionBank).mockImplementation(() => { throw new Error('sensitive'); });
 const response = await POST(request({ action: 'start', studentId: 'GABIM' }));
 expect(response.status).toBe(503);
 expect(await response.json()).toEqual({ error: { code: 'question_bank_unavailable', message: 'question_bank_unavailable' } });
});
