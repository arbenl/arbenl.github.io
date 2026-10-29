import { expect, it } from 'vitest';
import { submissionProgress } from '../lib/attendance/submission-progress';
import type { WeeklySubmission } from '../lib/attendance/submissions';

const today = new Date('2026-10-29T15:00:00Z');
function submission(week: number, githubId = '100'): WeeklySubmission {
  return { githubId, login: 'student', week, number: week, url: `https://github.com/example/course/issues/${week}` };
}
it('counts unique submitted weeks across the semester so far, including feedback weeks', () => {
  expect(submissionProgress([submission(1), submission(2), submission(3), submission(7), submission(7), submission(8), submission(2, '200')], '100', today))
    .toEqual({ completed: 4, total: 7, percentage: 57 });
});
it('distinguishes a confirmed zero from an unavailable or unlinked identity', () => {
  expect(submissionProgress([], '100', today)).toEqual({ completed: 0, total: 7, percentage: 0 });
  expect(submissionProgress(null, '100', today)).toBeNull();
  expect(submissionProgress([], null, today)).toBeNull();
});
it('caps complete progress at 100 percent and excludes future submissions', () => {
  expect(submissionProgress(Array.from({ length: 15 }, (_, i) => submission(i + 1)), '100', today))
    .toEqual({ completed: 7, total: 7, percentage: 100 });
});
it('uses the course local date at the weekly midnight boundary', () => {
  expect(submissionProgress([submission(7)], '100', new Date('2026-10-28T22:59:59Z')))
    .toEqual({ completed: 0, total: 6, percentage: 0 });
  expect(submissionProgress([submission(7)], '100', new Date('2026-10-28T23:00:00Z')))
    .toEqual({ completed: 1, total: 7, percentage: 14 });
});
it('handles the period before teaching starts and after all fifteen weeks', () => {
  expect(submissionProgress([], '100', new Date('2026-09-01T12:00:00Z')))
    .toEqual({ completed: 0, total: 0, percentage: null });
  expect(submissionProgress([submission(1)], '100', new Date('2027-01-01T12:00:00Z')))
    .toEqual({ completed: 1, total: 15, percentage: 7 });
});
