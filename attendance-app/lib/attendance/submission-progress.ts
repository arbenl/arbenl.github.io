import type { WeeklySubmission } from './submissions';
import { CURRENT_COURSE_DATES } from './current-course';

export interface SubmissionProgress { completed: number; total: number; percentage: number | null }
export function submissionProgress(submissions: WeeklySubmission[] | null, githubId: string | null, now = new Date()): SubmissionProgress | null {
  if (submissions === null || !githubId) return null;
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const weeks = new Set(CURRENT_COURSE_DATES.filter(item => item.date <= today).map(item => item.week));
  const completed = new Set(submissions.filter(item => item.githubId === githubId && weeks.has(item.week)).map(item => item.week)).size;
  return { completed, total: weeks.size, percentage: weeks.size ? Math.round(completed / weeks.size * 100) : null };
}
