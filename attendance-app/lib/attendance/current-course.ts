export const CURRENT_COURSE = {
  title: "Programimi për Pajisje Mobile · Semestri Dimëror 2026/27",
  weekCount: 15,
  groupName: "G1+G2",
} as const;

const THURSDAYS = [
  "17.09.2026",
  "24.09.2026",
  "01.10.2026",
  "08.10.2026",
  "15.10.2026",
  "22.10.2026",
  "29.10.2026",
  "05.11.2026",
  "12.11.2026",
  "19.11.2026",
  "26.11.2026",
  "03.12.2026",
  "10.12.2026",
  "17.12.2026",
  "24.12.2026",
] as const;

const LECTURES = [
  "Hyrje në Mobile PWA, Next.js dhe AI",
  "Ideja e biznesit, PRD dhe arkitektura",
  "Komponentët dhe Next.js App Router",
  "Modelimi i bazës së të dhënave",
  "Autentifikimi dhe menaxhimi i sesionit",
  "PWA: manifesti, instalimi dhe offline",
  "Vlerësimi i MVP-së së parë",
  "Kamera, GPS dhe API-të e pajisjes",
  "State dhe ndërfaqet optimiste",
  "Sinkronizimi në kohë reale",
  "Njoftimet push",
  "Siguria mobile dhe validimi",
  "Performanca dhe Lighthouse",
  "Testimi dhe CI/CD",
  "Demo Day dhe mbrojtja e projektit",
] as const;

const LABS = [
  "PRD-ja dhe prototipi i biznesit",
  "Struktura e aplikacionit dhe navigimi",
  "Skema e të dhënave dhe migrimet",
  "Hyrja e përdoruesit dhe autorizimi",
  "Instalimi PWA dhe cache offline",
  "Përgatitja dhe demonstrimi i MVP-së",
  "Integrimi i kamerës dhe GPS-it",
  "Përditësimet optimiste",
  "Të dhënat live",
  "Njoftimet në pajisje",
  "Kontrolli i sigurisë",
  "Optimizimi për telefon",
  "Pipeline-i dhe testet finale",
  "Showcase i aplikacionit të biznesit",
] as const;

export interface CurrentCourseSession {
  weekNumber: number;
  kind: "lecture" | "lab";
  groupName: string;
  startTime: string;
  title: string;
}

export const CURRENT_COURSE_SESSIONS: CurrentCourseSession[] = THURSDAYS.flatMap(
  (date, index) => {
    const weekNumber = index + 1;
    const lecture: CurrentCourseSession = {
      weekNumber,
      kind: "lecture",
      groupName: CURRENT_COURSE.groupName,
      startTime: "16:30",
      title: `${date} · 16:30 · Ligjërata ${weekNumber} — ${LECTURES[index]}`,
    };
    if (weekNumber === 1) {
      return [lecture];
    }
    return [
      lecture,
      ...([{ groupName: "G1", startTime: "14:45" }, { groupName: "G2", startTime: "18:00" }]).map(({ groupName, startTime }) => ({
        weekNumber,
        kind: "lab" as const,
        groupName,
        startTime,
        title: `${date} · ${startTime} · Ushtrime ${weekNumber} · ${groupName} — ${LABS[index - 1]}`,
      })),
    ];
  },
);

export function sessionIncludesGroup(kind: string, sessionGroup: string, studentGroup: string) {
  return sessionGroup === studentGroup ||
    (kind === "lecture" && sessionGroup === CURRENT_COURSE.groupName && ["G1", "G2"].includes(studentGroup));
}
