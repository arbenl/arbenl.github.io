import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  report: vi.fn(),
  submissions: vi.fn(),
  tests: vi.fn(),
}));
vi.mock("../../lib/auth/session", () => ({
  getCurrentSession: async () => null,
}));
vi.mock("../../lib/attendance/service", async (orig) => ({
  ...(await orig<typeof import("../../lib/attendance/service")>()),
  attendanceService: { getCourseActivityReport: mocks.report },
}));
vi.mock("../../lib/attendance/submissions", () => ({
  loadSubmissions: mocks.submissions,
}));
vi.mock("../../lib/colloquium/service", () => ({
  progressResults: mocks.tests,
}));
import Page from "../../app/progress/page";
import { AttendanceServiceError } from "../../lib/attendance/service";
it("does not read submissions or test results before membership authorization", async () => {
  mocks.report.mockRejectedValue(
    new AttendanceServiceError(403, "forbidden", "Forbidden"),
  );
  await Page();
  expect(mocks.submissions).not.toHaveBeenCalled();
  expect(mocks.tests).not.toHaveBeenCalled();
});
