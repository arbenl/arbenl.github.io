import {render,screen,cleanup} from "@testing-library/react";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  report: vi.fn(),
  submissions: vi.fn(),
  tests: vi.fn(),
  session: vi.fn(),
}));
vi.mock("../../lib/auth/session", () => ({
  getCurrentSession: mocks.session,
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
  const page = await Page();
  render(page);
  expect(screen.getByRole("button", { name: "Hyr me GitHub" })).toBeTruthy();
  expect(screen.queryByLabelText("Kodi personal")).toBeNull();
  cleanup();
  expect(mocks.submissions).not.toHaveBeenCalled();
  expect(mocks.tests).not.toHaveBeenCalled();
});

it("takes a signed-in unregistered student to profile activation instead of another GitHub login",async()=>{
 mocks.session.mockResolvedValue({user:{name:"Student Test",githubLogin:"student-test"}});
 mocks.report.mockRejectedValue(new AttendanceServiceError(403,"forbidden","Forbidden"));
 const view=render(await Page());
 expect(view.getByRole("link",{name:"Aktivizo profilin tim"}).getAttribute("href")).toBe("/student/activate");
 expect(view.getByText(/student-test/)).toBeTruthy();
 cleanup();
});
