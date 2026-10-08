export interface SubmissionIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  user: { id: number; login: string };
  pull_request?: unknown;
}

export interface WeeklySubmission {
  githubId: string;
  login: string;
  week: number;
  number: number;
  url: string;
}

export function parseSubmissions(issues: SubmissionIssue[]): WeeklySubmission[] {
  const unique = new Map<string, WeeklySubmission>();
  for (const issue of issues) {
    if (issue.pull_request || issue.created_at < "2026-09-01") continue;
    const body = issue.body ?? "";
    if (!/^### Linku i punës në GitHub\s*$/mu.test(body)) continue;
    const weekField = body.match(/^### Java\s*\n+Java\s+(\d+)\s*$/mu);
    const week = weekField ? Number(weekField[1]) : /^\[MOBILE J02\]/u.test(issue.title) ? 2 : 0;
    if (week < 1 || week > 15) continue;
    const githubId = String(issue.user.id);
    const key = `${githubId}:${week}`;
    const existing = unique.get(key);
    if (!existing || issue.number > existing.number) {
      unique.set(key, { githubId, login: issue.user.login, week, number: issue.number, url: issue.html_url });
    }
  }
  return [...unique.values()];
}

export async function loadSubmissions(): Promise<WeeklySubmission[]> {
  const issues: SubmissionIssue[] = [];
  // Read every page, including closed submissions. Never treat a failed page as no work.
  for (let page = 1; page <= 50; page += 1) {
    const response = await fetch(`https://api.github.com/repos/arbenl/arbenl-mobile-assignments-2025/issues?state=all&since=2026-09-01T00:00:00Z&per_page=100&page=${page}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Submissions could not be loaded");
    const batch = await response.json() as SubmissionIssue[];
    issues.push(...batch);
    if (!response.headers.get("link")?.includes('rel="next"')) return parseSubmissions(issues);
  }
  throw new Error("Submission pagination exceeded the supported range");
}
