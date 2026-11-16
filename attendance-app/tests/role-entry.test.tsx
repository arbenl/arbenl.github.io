import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthorizationError } from "../lib/auth/session";
const mocks = vi.hoisted(() => ({ staff: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("../lib/auth/session", async (original) => ({ ...await original<object>(), requireCurrentStaff: mocks.staff }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import Home from "../app/page";
import StudentPage from "../app/student/page";
import ActivatePage from "../app/student/activate/page";
import CheckInPage from "../app/check-in/page";
import StaffPage from "../app/staff/page";
afterEach(() => vi.resetAllMocks());
describe("course role entry", () => {
  for (const [name, page] of [["QR check-in", CheckInPage], ["home", Home], ["student history", StudentPage], ["student activation", ActivatePage]] as const) {
    it(`sends the verified professor from ${name} to the professor panel`, async () => {
      mocks.staff.mockResolvedValue({role:"professor"});
      mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
      await expect(Promise.resolve().then(() => page())).rejects.toThrow("REDIRECT:/staff");
    });
    it(`keeps ${name} available to students`, async () => {
      mocks.staff.mockRejectedValue(new AuthorizationError("Student", 403));
      expect(await page()).toBeTruthy();
      expect(mocks.redirect).not.toHaveBeenCalled();
    });
  }
  it("does not present a database failure as an unauthorized professor", async () => {
    mocks.staff.mockRejectedValue(new Error("Database unavailable"));
    await expect(StaffPage()).rejects.toThrow("Database unavailable");
  });
  it("gives unauthenticated visitors both course entrances", async () => {
    mocks.staff.mockRejectedValue(new AuthorizationError("Login", 401));
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain('href="/staff"');
    expect(html).toContain('href="/progress"');
  });
});
