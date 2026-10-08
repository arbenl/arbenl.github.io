import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSubmissions, parseSubmissions, type SubmissionIssue } from "../lib/attendance/submissions";

function issue(number: number, week = 3, userId = 100): SubmissionIssue {
  return { number, title: "[MOBILE DORËZIM]", body: `### Java\n\nJava ${week}\n\n### Linku i punës në GitHub\n\nhttps://github.com/student/project`,
    html_url: `https://github.com/arbenl/arbenl-mobile-assignments-2025/issues/${number}`, created_at: "2026-10-01T12:00:00Z", user: { id: userId, login: `student${userId}` } };
}
afterEach(() => vi.restoreAllMocks());
describe("weekly submissions", () => {
  it("deduplicates by stable author ID and week, retains latest link, and supports the previous week 2 form", () => {
    const legacy = { ...issue(4), title: "[MOBILE J02] RideShare", body: "### Linku i punës në GitHub\n\nhttps://github.com/student/project" };
    const rows = parseSubmissions([issue(3), issue(1), issue(2, 2), legacy, issue(6, 3, 200),
      { ...issue(10), pull_request: {} }, { ...issue(11), created_at: "2025-10-01" }, issue(12, 16),
      { ...issue(13), body: "### Java\n\nJava 3" }]);
    expect(rows.map(r => [r.githubId, r.week, r.number])).toEqual([["100", 3, 3], ["100", 2, 4], ["200", 3, 6]]);
  });
  it("reads all pages including closed issues, with more than 30 authors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify(
      Array.from({ length: 100 }, (_, i) => issue(i + 1, 3, i + 100))), { headers: { link: '<https://api.github.com/next>; rel="next"' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([issue(101, 3, 300)])));
    expect(await loadSubmissions()).toHaveLength(101);
    expect(fetchMock.mock.calls[0][0]).toContain("state=all");
    expect(fetchMock.mock.calls[1][0]).toContain("page=2");
  });
  it("fails the whole read when a later page is unavailable, rather than reporting missing work", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([issue(1)]), { headers: { link: '<https://api.github.com/next>; rel="next"' } }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 429 }));
    await expect(loadSubmissions()).rejects.toThrow("could not be loaded");
  });
});
