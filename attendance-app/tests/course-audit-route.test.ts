import { afterEach, expect, it, vi } from "vitest";
import {
  AuthorizationError,
  getCurrentSession,
  requireStaff,
} from "../lib/auth/session";
import { attendanceService } from "../lib/attendance/service";
import { GET } from "../app/api/staff/course-audit/route";
vi.mock("../lib/auth/session", async (original) => ({
  ...(await original<typeof import("../lib/auth/session")>()),
  getCurrentSession: vi.fn(),
  requireStaff: vi.fn(),
}));
vi.mock("../lib/attendance/service", () => ({
  attendanceService: { getCourseActivityReport: vi.fn() },
}));
afterEach(() => vi.resetAllMocks());
it.each([401, 403] as const)(
  "denies %s before accessing private class data",
  async (status) => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    vi.mocked(requireStaff).mockRejectedValue(
      new AuthorizationError("Denied", status),
    );
    const response = await GET();
    expect(response.status).toBe(status);
    expect(attendanceService.getCourseActivityReport).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("profiles");
  },
);
