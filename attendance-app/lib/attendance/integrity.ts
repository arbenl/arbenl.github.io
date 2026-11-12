import { CURRENT_COURSE, CURRENT_COURSE_DATES } from "./current-course";
interface Profile {
  id: string;
  student_id: string;
  full_name: string;
  email: string | null;
  group_name: string;
  user_id: string | null;
  github_id: string | null;
  github_username: string | null;
}
interface Work {
  githubId: string;
  login: string;
  week: number;
  number: number;
  url: string;
}
export interface IntegritySnapshot {
  version: number;
  course: string;
  generatedAt: string;
  profiles: Profile[];
  attendance: {
    roster_id: string;
    session_id: string;
    status: string;
    kind: string;
    state: string;
    week_number: number;
    group_name: string;
  }[];
  tests: { rosterId: string; score: number; maxScore: number; week: number }[];
  submissions: Work[] | null;
  report: {
    students: {
      rosterId: string;
      githubId: string | null;
      submissionGithubIds?: string[];
    }[];
  };
  cards: {
    id: string;
    total: number;
    lecture: number;
    lab: number;
    percentage: number | null;
    submitted: number;
    tests: { score: number }[] | null;
  }[];
}
const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function auditCourse(snapshot: IntegritySnapshot) {
  if (snapshot.version !== 1 || snapshot.course !== CURRENT_COURSE.title)
    throw new Error("Only the current Mobile 2026/2027 course is supported");
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date(snapshot.generatedAt));
  const dueWeeks = new Set(
    CURRENT_COURSE_DATES.filter((w) => w.date <= today).map((w) => w.week),
  );
  const owners = new Map<string, string>();
  for (const s of snapshot.report.students)
    for (const id of [s.githubId, ...(s.submissionGithubIds ?? [])])
      if (id) {
        if (owners.has(id) && owners.get(id) !== s.rosterId)
          throw new Error("Submission identity assigned to multiple profiles");
        owners.set(id, s.rosterId);
      }
  const students = snapshot.profiles.map((p) => {
    const flags: { kind: string; detail: string }[] = [];
    const card = snapshot.cards.find((c) => c.id === p.id);
    if (!card)
      flags.push({ kind: "error", detail: "Karta mungon nga regjistri" });
    const rows = snapshot.attendance.filter(
      (a) =>
        a.roster_id === p.id &&
        a.status === "present" &&
        ["open", "closed"].includes(a.state),
    );
    const lecture = new Set(
        rows.filter((a) => a.kind === "lecture").map((a) => a.session_id),
      ).size,
      lab = new Set(
        rows.filter((a) => a.kind === "lab").map((a) => a.session_id),
      ).size;
    if (
      card &&
      (card.total !== lecture + lab ||
        card.lecture !== lecture ||
        card.lab !== lab)
    )
      flags.push({
        kind: "error",
        detail: "Numërimi i pjesëmarrjes nuk përputhet me regjistrimet",
      });
    const scores = snapshot.tests.filter((t) => t.rosterId === p.id);
    if (
      card?.tests === null ||
      (card?.tests &&
        (card.tests.length !== scores.length ||
          card.tests.reduce((n, t) => n + t.score, 0) !==
            scores.reduce((n, t) => n + t.score, 0)))
    )
      flags.push({
        kind: "error",
        detail: "Pikët në kartë nuk përputhen me testin e publikuar",
      });
    const work =
      snapshot.submissions?.filter(
        (w) => owners.get(w.githubId) === p.id && dueWeeks.has(w.week),
      ) ?? null;
    const completed = work ? new Set(work.map((w) => w.week)).size : null;
    const hasAccount = snapshot.report.students.some(
      (s) => s.rosterId === p.id && !!s.githubId,
    );
    const expected =
      completed !== null && hasAccount && dueWeeks.size
        ? Math.round((completed / dueWeeks.size) * 100)
        : null;
    if (
      card &&
      (card.percentage !== expected ||
        (completed !== null && card.submitted !== completed))
    )
      flags.push({
        kind: "error",
        detail: "Përqindja e dorëzimeve nuk përputhet me javët unike",
      });
    if (!p.github_id)
      flags.push({
        kind: "review",
        detail: "GitHub nuk është lidhur për hyrje nga pajisje tjetër",
      });
    if (
      snapshot.profiles.some(
        (other) =>
          other.id !== p.id && key(other.full_name) === key(p.full_name),
      )
    )
      flags.push({
        kind: "review",
        detail: "Emër i përsëritur: kërkon verifikim, jo bashkim automatik",
      });
    if (
      snapshot.profiles.some(
        (other) =>
          other.id !== p.id &&
          (key(other.student_id) === key(p.student_id) ||
            (!!p.email &&
              other.email?.trim().toLowerCase() ===
                p.email.trim().toLowerCase())),
      )
    )
      flags.push({
        kind: "review",
        detail: "Identifikues ose email i përsëritur",
      });
    const candidates = [
      ...new Map(
        (snapshot.submissions ?? [])
          .filter(
            (w) =>
              !owners.has(w.githubId) &&
              key(p.full_name).length >= 6 &&
              (key(w.login) === key(p.full_name) ||
                key(w.login).startsWith(key(p.full_name))),
          )
          .map((w) => [w.githubId, { login: w.login, source: w.url }]),
      ).values(),
    ];
    if (candidates.length)
      flags.push({
        kind: "review",
        detail:
          "U gjet llogari dorëzimi me emër të ngjashëm; kandidaturë, jo provë identiteti",
      });
    return {
      id: p.id,
      name: p.full_name,
      group: p.group_name,
      github: p.github_username,
      githubLoginReady: !!p.user_id && !!p.github_id,
      lecture,
      lab,
      total: lecture + lab,
      testPoints: scores.length
        ? scores.reduce((n, t) => n + t.score, 0)
        : null,
      submitted: completed,
      percentage: expected,
      candidates,
      flags,
    };
  });
  return {
    course: snapshot.course,
    generatedAt: snapshot.generatedAt,
    summary: {
      students: students.length,
      weeksDue: dueWeeks.size,
      dataErrors: students.filter((s) =>
        s.flags.some((f) => f.kind === "error"),
      ).length,
      reviewNeeded: students.filter((s) =>
        s.flags.some((f) => f.kind === "review"),
      ).length,
      githubReady: students.filter((s) => s.githubLoginReady).length,
      withoutConfirmedAttendance: students.filter((s) => s.total === 0).length,
      submissionSourceAvailable: snapshot.submissions !== null,
    },
    students,
  };
}
