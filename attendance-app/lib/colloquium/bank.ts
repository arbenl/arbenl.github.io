import { createDecipheriv } from 'node:crypto';
import encrypted from '../../private-materials/colloquium-01.encrypted.json';
import type { BankQuestion } from './core';
let cached: BankQuestion[] | undefined;
export function permitsSyntheticBank(environment: Record<string, string | undefined> = process.env): boolean {
  if (environment.E2E_TEST_AUTH !== "1" || environment.E2E_DISPOSABLE_DATABASE !== "1" || environment.VERCEL !== undefined)
    return false;
  try {
    const url = new URL(environment.DATABASE_URL ?? "");
    return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.pathname === "/attendance_e2e";
  }
  catch {
    return false;
  }
}
function syntheticBank(): BankQuestion[] {
  return Array.from({ length: 10 }, (_, i) => ({ id: `testonly-${i + 1}`, prompt: `Pyetje vetëm për provën e izoluar ${i + 1}: zgjidh opsionin e parë sipas tekstit.`, source: "synthetic isolated E2E fixture", correctOptionId: "test-correct", options: [{ id: "test-correct", text: "Përgjigjja e provës" }, { id: "test-wrong-a", text: "Alternativa A" }, { id: "test-wrong-b", text: "Alternativa B" }] }));
}
export function getQuestionBank(version = "mobile-01-v1"): BankQuestion[] {
  if (version !== encrypted.version)
    throw new Error("Unsupported colloquium bank version");
  if (permitsSyntheticBank())
    return syntheticBank();
  if (cached)
    return cached;
  const key = process.env.COLLOQUIUM_BANK_KEY;
  if (!key || !/^[0-9a-f]{64}$/i.test(key))
    throw new Error('Colloquium bank is unavailable');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const bank = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.data, 'base64')), decipher.final()]).toString()) as BankQuestion[];
  if (bank.length !== 10 || bank.some(q => q.options.length !== 3 || q.options.filter(o => o.id === q.correctOptionId).length !== 1))
    throw new Error('Invalid colloquium bank');
  return cached = bank;
}
