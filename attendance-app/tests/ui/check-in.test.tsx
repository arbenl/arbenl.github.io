import { readFileSync } from "node:fs";

import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock("next-auth/react", () => ({ signIn: auth.signIn }));

import { CheckInResult } from "../../components/check-in-result";

const TOKEN = "a".repeat(64);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function checkInError(code: string, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
}

beforeEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  auth.signIn.mockReset();
  window.history.replaceState({}, "", "/check-in");
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.cookie = "attendance-test=; Max-Age=0; Path=/";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("student check-in", () => {
  it("captures a fragment token, removes it from browser history, and sends one POST", async () => {
    window.sessionStorage.setItem(
      "attendance-check-in",
      JSON.stringify({ token: "b".repeat(64), capturedAt: 0 }),
    );
    window.history.replaceState({}, "", `/check-in#token=${TOKEN}`);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        expect(window.sessionStorage.getItem("attendance-check-in")).toBeNull();
        return jsonResponse({
          sessionTitle: "Ligjërata 1",
          status: "present",
          recordedAt: "2026-09-17T10:00:00.000Z",
          duplicate: false,
        });
      });

    const view = render(<CheckInResult />);

    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/check-in", expect.objectContaining({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: TOKEN }),
    }));
    await waitFor(() =>
      expect(view.getByRole("status").textContent).toContain("Ligjërata 1"),
    );
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.getItem("attendance-check-in")).toBeNull();
    expect(document.cookie).not.toContain(TOKEN);
    expect(window.location.href).not.toContain(TOKEN);
  });

  it("lets a student retry a transient busy response with the same scanned code", async () => {
    window.history.replaceState({}, "", `/check-in#token=${TOKEN}`);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(checkInError("server_busy", "Service unavailable", 503))
      .mockResolvedValueOnce(jsonResponse({
        sessionTitle: "Ushtrimet 2 · G2",
        status: "present",
        recordedAt: "2026-09-24T16:45:00.000Z",
        duplicate: false,
      }));
    const view = render(<CheckInResult />);
    const retry = await view.findByRole("button", { name: "Provo sërish" });
    fireEvent.click(retry);
    await waitFor(() => expect(view.getByRole("heading", { name: "Vijueshmëria u konfirmua" })).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, request] of fetchMock.mock.calls) {
      expect(request).toMatchObject({ body: JSON.stringify({ token: TOKEN }) });
    }
  });

  it("captures and submits exactly once under React Strict Mode", async () => {
    window.history.replaceState({}, "", `/check-in#token=${TOKEN}`);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        sessionTitle: "Ligjërata Strict",
        status: "present",
        recordedAt: "2026-09-17T10:00:00.000Z",
        duplicate: false,
      }),
    );

    const view = render(
      <StrictMode>
        <CheckInResult />
      </StrictMode>,
    );

    await waitFor(() =>
      expect(view.getByRole("status").textContent).toContain("Ligjërata Strict"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
  });

  it("keeps a login token in same-tab storage for at most five minutes and deletes it before callback POST", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T10:00:00.000Z"));
    window.history.replaceState({}, "", `/check-in#token=${TOKEN}`);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        checkInError("authentication_required", "Authentication required", 401),
      );

    const first = render(<CheckInResult />);
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
    fireEvent.click(first.getByRole("button", { name: /github/i }));

    expect(JSON.parse(window.sessionStorage.getItem("attendance-check-in") ?? "{}"))
      .toEqual({ token: TOKEN, capturedAt: Date.now() });
    expect(auth.signIn).toHaveBeenCalledWith("github", { callbackUrl: "/check-in" });
    expect(window.localStorage.length).toBe(0);
    first.unmount();

    fetchMock.mockImplementation(async () => {
      expect(window.sessionStorage.getItem("attendance-check-in")).toBeNull();
      return jsonResponse({
        sessionTitle: "Ushtrimet 1",
        status: "present",
        recordedAt: "2026-09-17T10:00:01.000Z",
        duplicate: false,
      });
    });
    window.history.replaceState({}, "", "/check-in?token=must-not-be-used");
    render(<CheckInResult />);
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());

    expect(window.sessionStorage.getItem("attendance-check-in")).toBeNull();
    expect(window.location.search).toBe("");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/check-in",
      expect.objectContaining({ body: JSON.stringify({ token: TOKEN }) }),
    );
  });

  it("deletes an OAuth handoff older than five minutes without sending another POST", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T10:00:00.000Z"));
    window.history.replaceState({}, "", `/check-in#token=${TOKEN}`);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      checkInError("authentication_required", "Authentication required", 401),
    );

    const first = render(<CheckInResult />);
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
    fireEvent.click(first.getByRole("button", { name: /github/i }));
    expect(window.sessionStorage.getItem("attendance-check-in")).not.toBeNull();
    first.unmount();

    vi.setSystemTime(new Date("2026-09-17T10:05:00.001Z"));
    window.history.replaceState({}, "", "/check-in");
    const callback = render(<CheckInResult />);
    await act(async () => Promise.resolve());

    expect(window.sessionStorage.getItem("attendance-check-in")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callback.getByRole("alert").textContent).toMatch(/skano qr-në/i);
  });

  it("preserves the token when the inline semester load requires re-authentication and resumes after callback", async () => {
    window.history.replaceState({}, "", `/check-in#token=${TOKEN}`);
    let checkIns = 0;
    let semesterLoads = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/check-in") {
        checkIns += 1;
        return checkInError(
          "roster_not_activated",
          "Activate your roster profile before checking in",
          409,
        );
      }
      semesterLoads += 1;
      if (semesterLoads === 1) {
        return checkInError("authentication_required", "Authentication required", 401);
      }
      return jsonResponse([
        { id: "3bcd1f08-29ee-4bf8-bb93-7c9094311bf3", title: "Vjeshtë 2026" },
      ]);
    });

    const first = render(<CheckInResult />);
    await waitFor(() => first.getByRole("button", { name: /github/i }));
    fireEvent.click(first.getByRole("button", { name: /github/i }));

    expect(JSON.parse(window.sessionStorage.getItem("attendance-check-in") ?? "{}"))
      .toMatchObject({ token: TOKEN });
    expect(auth.signIn).toHaveBeenCalledWith("github", { callbackUrl: "/check-in" });
    first.unmount();

    window.history.replaceState({}, "", "/check-in");
    const callback = render(<CheckInResult />);
    await waitFor(() => callback.getByRole("form", { name: /aktivizo profilin/i }));
    expect(window.sessionStorage.getItem("attendance-check-in")).toBeNull();
    expect(checkIns).toBe(2);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("preserves the token when inline activation submit requires re-authentication and resumes after callback", async () => {
    window.history.replaceState({}, "", `/check-in#token=${TOKEN}`);
    let checkIns = 0;
    let activationAttempts = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/check-in") {
        checkIns += 1;
        return checkInError(
          "roster_not_activated",
          "Activate your roster profile before checking in",
          409,
        );
      }
      if (url === "/api/semesters") {
        return jsonResponse([
          { id: "3bcd1f08-29ee-4bf8-bb93-7c9094311bf3", title: "Vjeshtë 2026" },
        ]);
      }
      activationAttempts += 1;
      return checkInError("authentication_required", "Authentication required", 401);
    });

    const first = render(<CheckInResult />);
    await waitFor(() => first.getByRole("form", { name: /aktivizo profilin/i }));
    await waitFor(() => expect(first.queryByLabelText(/semestri/i)).toBeNull());
    fireEvent.change(first.getByLabelText(/emaili që/i), { target: { value: "arta@example.com" } });
    fireEvent.change(first.getByLabelText(/emailin përsëri/i), { target: { value: "arta@example.com" } });
    fireEvent.change(first.getByLabelText(/grupi i ushtrimeve/i), { target: { value: "G1" } });
    fireEvent.change(first.getByLabelText(/^emri$/i), { target: { value: "Arta" } });
    fireEvent.change(first.getByLabelText(/mbiemri/i), { target: { value: "Kola" } });
    fireEvent.change(first.getByLabelText(/student id/i), { target: { value: "A-100" } });
    fireEvent.submit(first.getByRole("form", { name: /aktivizo profilin/i }));
    await waitFor(() => first.getByRole("button", { name: /github/i }));
    fireEvent.click(first.getByRole("button", { name: /github/i }));

    expect(activationAttempts).toBe(1);
    expect(JSON.parse(window.sessionStorage.getItem("attendance-check-in") ?? "{}"))
      .toMatchObject({ token: TOKEN });
    first.unmount();

    window.history.replaceState({}, "", "/check-in");
    const callback = render(<CheckInResult />);
    await waitFor(() => callback.getByRole("form", { name: /aktivizo profilin/i }));
    expect(window.sessionStorage.getItem("attendance-check-in")).toBeNull();
    expect(checkIns).toBe(2);
  });

  it("renders activation inline and resumes the scan after a successful match", async () => {
    window.history.replaceState({}, "", `/check-in#token=${TOKEN}`);
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url === "/api/semesters") {
        return jsonResponse([
          { id: "3bcd1f08-29ee-4bf8-bb93-7c9094311bf3", title: "Vjeshtë 2026" },
        ]);
      }
      if (url === "/api/roster/activate") {
        expect(init?.body).toContain("A-100");
        return jsonResponse({ id: "roster-a" });
      }
      if (calls.filter((candidate) => candidate === "/api/check-in").length === 1) {
        return checkInError(
          "roster_not_activated",
          "Activate your roster profile before checking in",
          409,
        );
      }
      return jsonResponse({
        sessionTitle: "Ligjërata 2",
        status: "present",
        recordedAt: "2026-09-17T10:00:00.000Z",
        duplicate: false,
      });
    });

    const view = render(<CheckInResult />);
    await waitFor(() => view.getByRole("form", { name: /aktivizo profilin/i }));
    await waitFor(() => expect(view.queryByLabelText(/semestri/i)).toBeNull());
    fireEvent.change(view.getByLabelText(/emaili që/i), { target: { value: "arta@example.com" } });
    fireEvent.change(view.getByLabelText(/emailin përsëri/i), { target: { value: "arta@example.com" } });
    fireEvent.change(view.getByLabelText(/grupi i ushtrimeve/i), { target: { value: "G1" } });
    fireEvent.change(view.getByLabelText(/^emri$/i), { target: { value: "Arta" } });
    fireEvent.change(view.getByLabelText(/mbiemri/i), { target: { value: "Kola" } });
    fireEvent.change(view.getByLabelText(/student id/i), { target: { value: "A-100" } });
    fireEvent.submit(view.getByRole("form", { name: /aktivizo profilin/i }));

    await waitFor(() => expect(view.getByRole("status").textContent).toContain("Ligjërata 2"));
    expect(calls.filter((candidate) => candidate === "/api/check-in")).toHaveLength(2);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("requires a fresh scan when activation finishes after the two-minute local lifetime", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T10:00:00.000Z"));
    window.history.replaceState({}, "", `/check-in#token=${TOKEN}`);
    let checkIns = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/check-in") {
        checkIns += 1;
        return checkInError(
          "roster_not_activated",
          "Activate your roster profile before checking in",
          409,
        );
      }
      if (url === "/api/semesters") {
        return jsonResponse([
          { id: "3bcd1f08-29ee-4bf8-bb93-7c9094311bf3", title: "Vjeshtë 2026" },
        ]);
      }
      return jsonResponse({ id: "roster-a" });
    });

    const view = render(<CheckInResult />);
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
    vi.setSystemTime(new Date("2026-09-17T10:05:00.001Z"));
    expect(view.queryByLabelText(/semestri/i)).toBeNull();
    fireEvent.change(view.getByLabelText(/emaili që/i), { target: { value: "arta@example.com" } });
    fireEvent.change(view.getByLabelText(/emailin përsëri/i), { target: { value: "arta@example.com" } });
    fireEvent.change(view.getByLabelText(/grupi i ushtrimeve/i), { target: { value: "G1" } });
    fireEvent.change(view.getByLabelText(/^emri$/i), { target: { value: "Arta" } });
    fireEvent.change(view.getByLabelText(/mbiemri/i), { target: { value: "Kola" } });
    fireEvent.change(view.getByLabelText(/student id/i), { target: { value: "A-100" } });
    fireEvent.submit(view.getByRole("form", { name: /aktivizo profilin/i }));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());

    expect(checkIns).toBe(1);
    expect(view.getByRole("alert").textContent).toMatch(/skano përsëri/i);
  });

  it("defines touch controls with a minimum height of 44 CSS pixels", () => {
    const css = readFileSync(`${process.cwd()}/app/globals.css`, "utf8");
    expect(css).toMatch(/\.student-control[^}]*min-height:\s*44px/u);
  });
});
