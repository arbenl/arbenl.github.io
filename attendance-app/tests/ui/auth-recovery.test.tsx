import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next-auth/react", () => auth);
import { SignIn } from "../../components/sign-in";
import { SwitchAccount } from "../../components/student-access";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("offers a retry if GitHub sign-in fails before navigation", async () => {
  auth.signIn
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(undefined);
  const view = render(<SignIn callbackUrl="/student" />);
  fireEvent.click(view.getByRole("button", { name: "Hyr me GitHub" }));
  expect((await view.findByRole("alert")).textContent).toMatch(
    /Hyrja nuk filloi/,
  );
  fireEvent.click(view.getByRole("button", { name: "Hyr me GitHub" }));
  await waitFor(() => expect(auth.signIn).toHaveBeenCalledTimes(2));
  expect(auth.signIn).toHaveBeenLastCalledWith("github", {
    callbackUrl: "/student",
  });
});
it("reports failed sign-out and keeps account switching retryable", async () => {
  auth.signOut
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(undefined);
  const view = render(<SwitchAccount callbackUrl="/student" />);
  fireEvent.click(view.getByRole("button", { name: "Dil / Ndërro llogarinë" }));
  expect((await view.findByRole("alert")).textContent).toMatch(
    /Dalja nuk përfundoi/,
  );
  fireEvent.click(view.getByRole("button", { name: "Dil / Ndërro llogarinë" }));
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(2));
  expect(auth.signOut).toHaveBeenLastCalledWith({ callbackUrl: "/student" });
});
