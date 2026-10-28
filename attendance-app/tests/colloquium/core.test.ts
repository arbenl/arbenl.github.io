import { expect, it } from 'vitest';
import { shuffleQuestions, scoreAnswers, publicQuestions } from '../../lib/colloquium/core';
const bank = [{ id: 'q1', prompt: 'Pyetje', source: 'fixture', correctOptionId: 'yes', options: [{ id: 'yes', text: 'Po' }, { id: 'no', text: 'Jo' }, { id: 'maybe', text: 'Ndoshta' }] }];
it('persists independently opaque shuffled option IDs and never exposes semantic IDs/key/sources', () => {
  const questions = shuffleQuestions(bank);
  const visible = publicQuestions(questions, bank);
  expect(visible[0].options).toHaveLength(3);
  expect(visible[0].options.every(x => !['yes', 'no', 'maybe'].includes(x.id))).toBe(true);
  expect(JSON.stringify(visible)).not.toContain('correctOptionId');
  expect(JSON.stringify(visible)).not.toContain('fixture');
  expect(publicQuestions(questions, bank)).toEqual(visible);
});
it('scores only valid matching opaque choices; blanks and unknowns get zero', () => {
  const questions = shuffleQuestions(bank);
  const yes = questions[0].options.find(x => x.semanticId === 'yes')!.id;
  expect(scoreAnswers(questions, { q1: yes }, bank)).toBe(1);
  expect(scoreAnswers(questions, {}, bank)).toBe(0);
  expect(scoreAnswers(questions, { q1: 'yes' }, bank)).toBe(0);
});
