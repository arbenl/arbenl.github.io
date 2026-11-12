import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StudentProgress } from "../../components/student-progress";
import {
  progressCards,
  type ActivityReport,
} from "../../lib/attendance/progress";
afterEach(cleanup);
const report: ActivityReport = {
  students: [
    { rosterId: "1", fullName: "Arta Çela", groupName: "G1", githubId: "11" },
    { rosterId: "2", fullName: "Dren Test", groupName: "G2", githubId: null },
  ],
  sessions: [
    {
      id: "l",
      week: 1,
      kind: "lecture",
      title: "Ligjërata",
      state: "closed",
      groupName: "G1+G2",
    },
    {
      id: "u",
      week: 2,
      kind: "lab",
      title: "Ushtrime",
      state: "closed",
      groupName: "G2",
    },
  ],
  present: [
    { rosterId: "1", sessionId: "l" },
    { rosterId: "1", sessionId: "u" },
  ],
};
it("counts cross-group attendance, deduplicates sessions and excludes future work", () => {
  const cards = progressCards(
    { ...report, present: [...report.present, report.present[0]] },
    [
      {
        githubId: "11",
        login: "arta",
        week: 1,
        number: 1,
        url: "https://github.com/a/b/issues/1",
      },
      {
        githubId: "11",
        login: "arta",
        week: 15,
        number: 2,
        url: "https://github.com/a/b/issues/2",
      },
    ],
    [{ rosterId: "1", week: 7, score: 0, maxScore: 10 }],
    new Date("2026-09-24T12:00:00Z"),
  );
  expect(cards[0]).toMatchObject({
    lecture: 1,
    lab: 1,
    total: 2,
    submitted: 1,
    percentage: 50,
  });
  expect(cards[0].work).toHaveLength(2);
  expect(cards[0].tests?.[0].score).toBe(0);
  expect(cards[1].percentage).toBeNull();
});
it("shows own card first and searches names without accents; filters tests and registration", () => {
  const cards = progressCards(
    report,
    [],
    [{ rosterId: "1", week: 7, score: 7, maxScore: 10 }],
    new Date("2026-11-12T12:00:00Z"),
  );
  render(<StudentProgress cards={cards} viewerId="1" />);
  expect(screen.getByRole("heading", { name: "Arta Çela" })).toBeTruthy();
  expect(screen.getByText("7/10")).toBeTruthy();
  fireEvent.click(screen.getByText("Kërko studentin dhe filtro regjistrin"));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "cela" },
  });
  expect(screen.queryByRole("button", { name: /Dren Test/ })).toBeNull();
  fireEvent.change(screen.getByLabelText("Testi i mbajtur"), {
    target: { value: "missing" },
  });
  expect(screen.getByText(/Nuk u gjet student/)).toBeTruthy();
});
it("does not mark unavailable data or unlinked profiles red", () => {
  const cards = progressCards(
    report,
    null,
    null,
    new Date("2026-11-12T12:00:00Z"),
  );
  render(<StudentProgress cards={cards} viewerId="2" />);
  expect(screen.queryByText(/Pa dorëzim/)).toBeNull();
  expect(screen.getAllByText(/E panjohur/).length).toBeGreaterThan(0);
});

it("excludes explicitly marked staff test issues from student progress", async () => {
  const { parseSubmissions } = await import("../../lib/attendance/submissions");
  expect(
    parseSubmissions([
      {
        number: 804,
        title: "[MOBILE DORËZIM] [TEST STAFI 2026/2027] Java 8",
        body: "### Java\n\nJava 8\n\n### Linku i punës në GitHub\n\nhttps://github.com/example/repo",
        html_url: "https://github.com/example/course/issues/804",
        created_at: "2026-11-05",
        user: { id: 11, login: "test" },
      },
    ]),
  ).toEqual([]);
});

it("keeps teacher-verified submission evidence distinct from an account linked for login", () => {
  const cards = progressCards(
    {
      ...report,
      students: [
        {
          ...report.students[0],
          githubId: "20",
          loginGithubId: null,
          submissionLogins: ["arta-work"],
        },
      ],
    },
    [
      {
        githubId: "20",
        login: "arta-work",
        week: 1,
        number: 1,
        url: "https://github.com/example/course/issues/1",
      },
    ],
    [],
    new Date("2026-09-17T12:00:00Z"),
  );
  expect(cards[0]).toMatchObject({
    linked: false,
    percentage: 100,
    submitted: 1,
  });
  render(<StudentProgress cards={cards} viewerId="1" />);
  expect(screen.queryByText(/Vetëm profesori/)).toBeNull();
  expect(
    screen.getByText(/Dorëzime të verifikuara nga: arta-work/),
  ).toBeTruthy();
});
