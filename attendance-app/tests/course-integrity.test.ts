import { expect, it } from "vitest";
import {
  auditCourse,
  type IntegritySnapshot,
} from "../lib/attendance/integrity";
import { CURRENT_COURSE } from "../lib/attendance/current-course";
function fixture(): IntegritySnapshot {
  return {
    version: 1,
    course: CURRENT_COURSE.title,
    generatedAt: "2026-11-12T12:00:00Z",
    profiles: [
      {
        id: "a",
        student_id: "LOCAL-1",
        full_name: "Arta Test",
        email: "arta@example.test",
        group_name: "G1",
        user_id: "u",
        github_id: "10",
        github_username: "arta-login",
      },
    ],
    attendance: [
      {
        roster_id: "a",
        session_id: "lecture",
        status: "present",
        kind: "lecture",
        state: "closed",
        week_number: 8,
        group_name: "G2",
      },
      {
        roster_id: "a",
        session_id: "lab",
        status: "present",
        kind: "lab",
        state: "closed",
        week_number: 8,
        group_name: "G1",
      },
      {
        roster_id: "a",
        session_id: "cancelled",
        status: "present",
        kind: "lab",
        state: "cancelled",
        week_number: 8,
        group_name: "G1",
      },
    ],
    tests: [{ rosterId: "a", week: 7, score: 9, maxScore: 10 }],
    submissions: [
      {
        githubId: "20",
        login: "arta-work",
        week: 5,
        number: 1,
        url: "https://github.com/example/course/issues/1",
      },
      {
        githubId: "20",
        login: "arta-work",
        week: 6,
        number: 2,
        url: "https://github.com/example/course/issues/2",
      },
      {
        githubId: "10",
        login: "arta-login",
        week: 6,
        number: 3,
        url: "https://github.com/example/course/issues/3",
      },
    ],
    report: {
      students: [
        { rosterId: "a", githubId: "10", submissionGithubIds: ["20"] },
      ],
    },
    cards: [
      {
        id: "a",
        total: 2,
        lecture: 1,
        lab: 1,
        submitted: 2,
        percentage: 22,
        tests: [{ score: 9 }],
      },
    ],
  };
}
it("audits cross-group presence, published score and deduplicated verified account submissions without changing data", () => {
  const data = fixture(),
    before = JSON.stringify(data),
    result = auditCourse(data);
  expect(result.summary.dataErrors).toBe(0);
  expect(result.students[0]).toMatchObject({
    total: 2,
    testPoints: 9,
    submitted: 2,
    percentage: 22,
  });
  expect(JSON.stringify(data)).toBe(before);
});
it("detects wrong displayed attendance, test score and percentage", () => {
  const data = fixture();
  data.cards[0] = {
    ...data.cards[0],
    total: 99,
    percentage: 0,
    tests: [{ score: 0 }],
  };
  expect(
    auditCourse(data).students[0].flags.filter((f) => f.kind === "error"),
  ).toHaveLength(3);
});
it("treats similar names as review candidates, never as an automatic identity match", () => {
  const data = fixture();
  data.report.students[0].submissionGithubIds = [];
  data.submissions = [
    {
      githubId: "30",
      login: "ArtaTest",
      week: 6,
      number: 10,
      url: "https://github.com/example/course/issues/10",
    },
  ];
  data.cards[0].submitted = 0;
  data.cards[0].percentage = 0;
  const result = auditCourse(data);
  expect(result.students[0].submitted).toBe(0);
  expect(result.students[0].candidates[0].login).toBe("ArtaTest");
  expect(result.summary.reviewNeeded).toBe(1);
});
it("refuses another subject and ambiguous mappings", () => {
  const data = fixture();
  expect(() => auditCourse({ ...data, course: "Mobile 2025" })).toThrow();
  data.report.students.push({
    rosterId: "other",
    githubId: "other",
    submissionGithubIds: ["20"],
  });
  expect(() => auditCourse(data)).toThrow("multiple profiles");
});

it("detects a missing published test and a wrong submission count even when the percentage matches", () => {
  const data = fixture();
  data.cards[0].tests = null;
  data.cards[0].submitted = 0;
  expect(
    auditCourse(data).students[0].flags.filter((f) => f.kind === "error"),
  ).toHaveLength(2);
});
it("keeps an unavailable submission source unknown and never reports a fabricated zero", () => {
  const data = fixture();
  data.submissions = null;
  data.cards[0].percentage = null;
  const result = auditCourse(data);
  expect(result.summary.submissionSourceAvailable).toBe(false);
  expect(result.students[0].percentage).toBeNull();
  expect(result.students[0].submitted).toBeNull();
  expect(result.summary.dataErrors).toBe(0);
});
