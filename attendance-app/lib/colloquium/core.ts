import { randomInt, randomUUID } from 'node:crypto';
import type { ColloquiumQuestion } from './types';
export interface BankQuestion {
  id: string;
  prompt: string;
  source: string;
  correctOptionId: string;
  options: {
    id: string;
    text: string;
  }[];
}
export interface QuestionOrder {
  id: string;
  options: {
    id: string;
    semanticId: string;
  }[];
}
export function shuffleQuestions(bank: BankQuestion[]): QuestionOrder[] {
  return bank.map(q => {
    const options = q.options.map(o => ({ id: randomUUID(), semanticId: o.id }));
    for (let i = options.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { id: q.id, options };
  });
}
export function publicQuestions(order: QuestionOrder[], bank: BankQuestion[]): ColloquiumQuestion[] {
  return order.map(q => {
    const source = bank.find(x => x.id === q.id)!;
    return { id: q.id, prompt: source.prompt, options: q.options.map(o => ({ id: o.id, text: source.options.find(x => x.id === o.semanticId)!.text })) };
  });
}
export function scoreAnswers(order: QuestionOrder[], answers: Record<string, string | null>, bank: BankQuestion[]): number {
  return order.reduce((sum, q) => sum + Number(q.options.find(o => o.id === answers[q.id])?.semanticId === bank.find(x => x.id === q.id)?.correctOptionId), 0);
}
