import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getQuestionBank } from './bank';
import { publicQuestions, scoreAnswers, shuffleQuestions } from './core';
import type { ColloquiumPreviewResult, ColloquiumPreviewRun } from './types';

const namespace = 'colloquium-private-preview:v1';
const bankVersion = 'mobile-01-v1';
const duration = 600000;
const ttl = 3600000;
const labelSchema = z.string().trim().min(1).max(100);
const proofSchema = z.object({
  purpose: z.literal(namespace), version: z.literal(1), bankVersion: z.literal(bankVersion),
  staffUserId: z.string().min(1), studentId: labelSchema,
  startedAt: z.number().int().nonnegative(), deadline: z.number().int().nonnegative(),
  order: z.array(z.object({ id: z.string(), publicId: z.uuid(), options: z.array(z.object({ id: z.uuid(), semanticId: z.string() }).strict()).length(3) }).strict()).length(10),
}).strict();
export class PreviewError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
function key() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new PreviewError(503, 'preview_unavailable');
  return createHmac('sha256', secret).update(namespace).digest();
}
function bank() {
  try { return getQuestionBank(bankVersion); }
  catch { throw new PreviewError(503, 'question_bank_unavailable'); }
}
function invalidProof(): never { throw new PreviewError(400, 'invalid_preview_proof'); }
export function startPreview(staffUserId: string, studentId: unknown, now = new Date()): ColloquiumPreviewRun {
  const parsed = labelSchema.safeParse(studentId);
  if (!parsed.success) throw new PreviewError(400, 'invalid_preview_index');
  const encryptionKey = key();
  const questions = bank();
  const order = shuffleQuestions(questions).map(q => ({ ...q, publicId: randomUUID() }));
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]];
  }
  const startedAt = now.getTime();
  const deadline = startedAt + duration;
  const payload = proofSchema.parse({ purpose: namespace, version: 1, bankVersion, staffUserId, studentId: parsed.data, startedAt, deadline, order });
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce);
  cipher.setAAD(Buffer.from(namespace));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  const proof = Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64url');
  return { private: true, studentId: parsed.data, serverTime: now.toISOString(), deadline: new Date(deadline).toISOString(), proof,
    questions: publicQuestions(order, questions).map((q, i) => ({ ...q, id: order[i].publicId })) };
}
export function gradePreview(staffUserId: string, proof: unknown, answers: unknown, now = new Date()): ColloquiumPreviewResult {
  if (typeof proof !== 'string' || proof.length < 40 || proof.length > 16000 || !/^[A-Za-z0-9_-]+$/.test(proof)) invalidProof();
  const encryptionKey = key();
  let payload: z.infer<typeof proofSchema>;
  try {
    const bytes = Buffer.from(proof, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(namespace));
    decipher.setAuthTag(bytes.subarray(12, 28));
    payload = proofSchema.parse(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()));
  } catch { invalidProof(); }
  if (payload.staffUserId !== staffUserId || payload.startedAt > now.getTime() || now.getTime() - payload.startedAt > ttl || payload.deadline !== payload.startedAt + duration) invalidProof();
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length > 10) throw new PreviewError(400, 'invalid_preview_answers');
  const mapped: Record<string, string | null> = {};
  for (const [questionId, optionId] of Object.entries(answers)) {
    const question = payload.order.find(q => q.publicId === questionId);
    if (!question || (optionId !== null && (typeof optionId !== 'string' || !question.options.some(o => o.id === optionId)))) throw new PreviewError(400, 'invalid_preview_answers');
    mapped[question.id] = optionId;
  }
  return { private: true, studentId: payload.studentId, score: scoreAnswers(payload.order, mapped, bank()), maxScore: 10 };
}
