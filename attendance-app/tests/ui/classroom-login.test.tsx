import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: auth.signIn }));
import StudentPage from "../../app/student/page";
import { ProfileForm } from "../../components/profile-form";
import { ClassroomLogin } from "../../components/classroom-login";

const token = "c".repeat(64);
const response = (enabled: boolean) => new Response(JSON.stringify({ enabled }));
beforeEach(() => { vi.restoreAllMocks(); auth.signIn.mockReset(); window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(cleanup);

async function fill(view: ReturnType<typeof render>, email = "arta@gmail.com") {
  await view.findByRole("form", { name: "Regjistrohu me QR" });
  fireEvent.change(view.getByLabelText("Emri", { exact: true }), { target: { value: "Arta" } });
  fireEvent.change(view.getByLabelText("Mbiemri"), { target: { value: "Kola" } });
  fireEvent.change(view.getByLabelText("Student ID"), { target: { value: "A-100" } });
  fireEvent.change(view.getByLabelText("Grupi i ushtrimeve"), { target: { value: "G1" } });
  fireEvent.change(view.getByLabelText("Emaili i fakultetit ose emaili privat"), { target: { value: email } });
}

describe("classroom registration", () => {
  for (const email of ["arta@gmail.com", "arta@universitetiaab.com"]) {
    it(`signs in with a live QR and one contact email (${email})`, async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(true));
      auth.signIn.mockResolvedValue({ ok: true, error: null });
      const onAuthenticated = vi.fn();
      const view = render(<ClassroomLogin token={token} onAuthenticated={onAuthenticated} />);
      await fill(view, email);
      expect(view.container.querySelectorAll('input[type="email"]')).toHaveLength(1);
      expect(view.container.querySelector('input[type="password"]')).toBeNull();
      fireEvent.submit(view.getByRole("form"));
      await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
      expect(auth.signIn).toHaveBeenCalledWith("classroom", { redirect: false, token, email, firstName: "Arta", lastName: "Kola", studentId: "A-100", groupName: "G1" });
      expect(fetchMock).toHaveBeenCalledWith("/api/classroom/status", expect.objectContaining({ cache: "no-store" }));
      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);
      expect(window.location.href).not.toContain(token);
    });
  }
  for (const unavailable of [false, "error"]) {
    it(`gates the form when readiness is ${unavailable}`, async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch");
      if (unavailable === "error") fetchMock.mockRejectedValue(new Error("offline"));
      else fetchMock.mockResolvedValue(response(false));
      const view = render(<ClassroomLogin token={token} onAuthenticated={vi.fn()} />);
      await view.findByText(/përkohësisht i padisponueshëm/i);
      expect(view.queryByRole("form")).toBeNull();
      expect(auth.signIn).not.toHaveBeenCalled();
    });
  }
  it("requires a valid contact email and all profile fields before sign-in", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(true));
    const view = render(<ClassroomLogin token={token} onAuthenticated={vi.fn()} />);
    const form = await view.findByRole("form");
    fireEvent.submit(form);
    expect(auth.signIn).not.toHaveBeenCalled();
    await fill(view, "invalid-email");
    fireEvent.submit(form);
    expect(auth.signIn).not.toHaveBeenCalled();
  });
  it("explains first QR entry on anonymous student history", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    const view = render(<StudentPage />);
    await view.findByText(/Për hyrjen e parë pa GitHub, skano QR-në aktive/);
    expect(view.getByRole("button", { name: /GitHub/ })).toBeTruthy();
  });
  it("explains first QR entry on anonymous profile setup", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    const view = render(<ProfileForm />);
    await view.findByText(/Për regjistrimin e parë pa GitHub, skano QR-në aktive/);
  });
  for (const [error, expected] of [["invalid_qr", /QR-ja ka skaduar/], ["profile_conflict", /Të dhënat nuk përputhen/], ["rate_limited", /Prit pak/]]) {
    it(`translates ${error} and preserves entered profile`, async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(response(true));
      auth.signIn.mockResolvedValue({ ok: false, error });
      const view = render(<ClassroomLogin token={token} onAuthenticated={vi.fn()} />);
      await fill(view);
      fireEvent.submit(view.getByRole("form"));
      expect((await view.findByRole("alert")).textContent).toMatch(expected);
      expect((view.getByLabelText("Emri", { exact: true }) as HTMLInputElement).value).toBe("Arta");
      expect((view.getByLabelText("Emaili i fakultetit ose emaili privat") as HTMLInputElement).value).toBe("arta@gmail.com");
    });
  }
  it("keeps failed credentials generic, offers a fresh QR and never signals success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(true));
    auth.signIn.mockResolvedValue({ ok: false, error: "CredentialsSignin" });
    const onAuthenticated = vi.fn();
    const view = render(<ClassroomLogin token={token} onAuthenticated={onAuthenticated} />);
    await fill(view);
    fireEvent.submit(view.getByRole("form"));
    expect((await view.findByRole("alert")).textContent).toMatch(/QR.*skado|skano.*QR/i);
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});
