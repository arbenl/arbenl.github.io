import { CURRENT_COURSE_DATES } from "./current-course";
import type { WeeklySubmission } from "./submissions";
export interface ActivityReport {
  viewerRosterId?: string | null;
  students: {
    rosterId: string;
    fullName: string;
    groupName: string;
    githubId: string | null;
    login?: string | null;
  }[];
  sessions: {
    id: string;
    week: number;
    kind: string;
    title: string;
    state: string;
    groupName: string;
  }[];
  present: { rosterId: string; sessionId: string }[];
}
export interface TestResult {
  rosterId: string;
  week: number;
  score: number;
  maxScore: number;
}
export function progressCards(
  report: ActivityReport,
  submissions: WeeklySubmission[] | null,
  tests: TestResult[] | null,
  now = new Date(),
) {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(now);
  const weeks = CURRENT_COURSE_DATES.filter((w) => w.date <= today).map(
    (w) => w.week,
  );
  const sessions = new Map(report.sessions.map((s) => [s.id, s]));
  return report.students.map((student) => {
    const attended = report.present.filter(
      (p) => p.rosterId === student.rosterId && sessions.has(p.sessionId),
    );
    const lecture = new Set(
      attended
        .filter((p) => sessions.get(p.sessionId)?.kind === "lecture")
        .map((p) => p.sessionId),
    ).size;
    const lab = new Set(
      attended
        .filter((p) => sessions.get(p.sessionId)?.kind === "lab")
        .map((p) => p.sessionId),
    ).size;
    const work = weeks.map((week) => ({
      week,
      submission:
        submissions === null || !student.githubId
          ? null
          : (submissions.find(
              (s) => s.githubId === student.githubId && s.week === week,
            ) ?? null),
      known: submissions !== null && !!student.githubId,
    }));
    const submitted = work.filter((w) => w.submission).length;
    return {
      id: student.rosterId,
      name: student.fullName,
      group: student.groupName,
      linked: !!student.githubId,
      lecture,
      lab,
      total: lecture + lab,
      work,
      percentage:
        submissions === null || !student.githubId || !weeks.length
          ? null
          : Math.round((submitted / weeks.length) * 100),
      submitted,
      tests: tests?.filter((t) => t.rosterId === student.rosterId) ?? null,
      attendance: report.sessions
        .filter(
          (s) =>
            s.groupName === student.groupName ||
            (s.kind === "lecture" && s.groupName === "G1+G2") ||
            attended.some((p) => p.sessionId === s.id),
        )
        .map((s) => ({
          ...s,
          present: attended.some((p) => p.sessionId === s.id),
        })),
    };
  });
}
export type ProgressCard = ReturnType<typeof progressCards>[number];
