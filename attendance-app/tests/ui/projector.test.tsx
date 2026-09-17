import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const qr = vi.hoisted(() => ({ toDataURL: vi.fn() }));
const staffGate = vi.hoisted(() => ({ requireCurrentStaff: vi.fn() }));

vi.mock("qrcode", () => ({ default: { toDataURL: qr.toDataURL } }));
vi.mock("../../lib/auth/session", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message: string, readonly status: 401 | 403) {
      super(message);
    }
  },
  requireCurrentStaff: staffGate.requireCurrentStaff,
}));

import { LiveProjector } from "../../components/live-projector";
import { SemesterAdmin } from "../../components/semester-admin";
import { SessionAdmin } from "../../components/session-admin";
import StaffPage from "../../app/staff/page";
import ProjectorPage from "../../app/staff/project/[sessionId]/page";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const SERVER_TIME = "2026-09-17T10:00:00.000Z";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: SESSION_ID,
    state: "open",
    serverTime: SERVER_TIME,
    checkinEndsAt: "2026-09-17T10:02:00.000Z",
    entries: [],
    total: 0,
    ...overrides,
  };
}

function challenge(overrides: Record<string, unknown> = {}) {
  return {
    token: "a".repeat(64),
    serverTime: SERVER_TIME,
    expiresAt: "2026-09-17T10:00:40.000Z",
    ...overrides,
  };
}

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

async function settle() {
  await act(async () => {
    for (let turn = 0; turn < 8; turn += 1) {
      await Promise.resolve();
    }
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/staff");
  vi.setSystemTime(new Date("2031-01-01T00:00:00.000Z"));
  vi.restoreAllMocks();
  qr.toDataURL.mockResolvedValue("data:image/png;base64,qr");
  staffGate.requireCurrentStaff.mockResolvedValue({ role: "professor" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("live projector", () => {
  it("uses server time, caps QR display at the session deadline, and rotates at 25 seconds", async () => {
    const browserStart = Date.now();
    const currentServerTime = () => new Date(
      Date.parse(SERVER_TIME) + (Date.now() - browserStart),
    ).toISOString();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/live")) {
        return response(snapshot({
          serverTime: currentServerTime(),
          checkinEndsAt: "2026-09-17T10:00:30.000Z",
        }));
      }
      return response(challenge({ serverTime: currentServerTime() }));
    });

    render(<LiveProjector sessionId={SESSION_ID} />);

    await settle();
    expect(screen.getByText("00:30")).toBeTruthy();
    expect(screen.getByAltText("QR për check-in")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/challenge")),
    ).toHaveLength(1);

    await advance(25_000);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/challenge")),
    ).toHaveLength(2);

    await advance(5_000);
    expect(screen.queryByAltText("QR për check-in")).toBeNull();
    expect(screen.getByText("00:00")).toBeTruthy();
    await advance(25_000);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/challenge")),
    ).toHaveLength(2);
  });

  it("hides a challenge at its own expiry when it expires before the session", async () => {
    const browserStart = Date.now();
    const currentServerTime = () => new Date(
      Date.parse(SERVER_TIME) + (Date.now() - browserStart),
    ).toISOString();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).endsWith("/live")
        ? response(snapshot({
            serverTime: currentServerTime(),
            checkinEndsAt: "2026-09-17T10:00:30.000Z",
          }))
        : response(challenge({
            serverTime: currentServerTime(),
            expiresAt: "2026-09-17T10:00:10.000Z",
          })),
    );

    render(<LiveProjector sessionId={SESSION_ID} />);
    await settle();
    expect(screen.getByAltText("QR për check-in")).toBeTruthy();
    await advance(10_000);
    expect(screen.queryByAltText("QR për check-in")).toBeNull();
    expect(screen.getByText("00:20")).toBeTruthy();
  });

  it("retries live failures after 1, 2, 4, 5 and 5 seconds, then replaces the full snapshot", async () => {
    const liveTimes: number[] = [];
    let liveAttempt = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/challenge")) {
        return response(challenge());
      }
      liveTimes.push(Date.now());
      liveAttempt += 1;
      if (liveAttempt === 1) {
        return response(snapshot({
          entries: [{ rosterId: "old", displayName: "Arta K.", recordedAt: SERVER_TIME }],
          total: 1,
        }));
      }
      if (liveAttempt < 7) {
        throw new TypeError("offline");
      }
      return response(snapshot({
        serverTime: "2026-09-17T10:00:18.000Z",
        entries: [{ rosterId: "new", displayName: "Besa D.", recordedAt: SERVER_TIME }],
        total: 1,
      }));
    });

    render(<LiveProjector sessionId={SESSION_ID} />);
    await settle();
    expect(screen.getByText("Arta K.")).toBeTruthy();

    await advance(1_000);
    expect(screen.getByText("të dhënat mund të jenë të vjetruara")).toBeTruthy();
    expect(screen.getByRole("list").className).toContain("is-stale");
    await advance(1_000 + 2_000 + 4_000 + 5_000 + 5_000);

    expect(liveTimes.slice(1).map((time, index, values) =>
      index === 0 ? time - liveTimes[0] : time - values[index - 1],
    )).toEqual([1_000, 1_000, 2_000, 4_000, 5_000, 5_000]);
    expect(screen.queryByText("Arta K.")).toBeNull();
    expect(screen.getByText("Besa D.")).toBeTruthy();
    expect(screen.queryByText("të dhënat mund të jenë të vjetruara")).toBeNull();
  });

  it("renders masked rows only and freezes after a confirmed closing snapshot", async () => {
    let liveAttempt = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).endsWith("/challenge")) {
        return response(challenge());
      }
      liveAttempt += 1;
      return response(snapshot({
        state: liveAttempt === 1 ? "open" : "closed",
        entries: [{
          rosterId: "row-1",
          displayName: "Arta K.",
          recordedAt: SERVER_TIME,
          fullName: "Arta Kola",
          studentId: "A-1",
          githubUsername: "student-a",
        }],
        total: 1,
      }));
    });

    render(<LiveProjector sessionId={SESSION_ID} />);
    await settle();
    expect(screen.getByText("Arta K.")).toBeTruthy();
    expect(screen.queryByText("Arta Kola")).toBeNull();
    expect(screen.queryByText("A-1")).toBeNull();
    expect(screen.queryByText("student-a")).toBeNull();

    await advance(1_000);
    expect(screen.getByText("Check-in u mbyll")).toBeTruthy();
    expect(screen.getByText("1", { selector: ".projector-total strong" })).toBeTruthy();
    const callsAtClose = fetchMock.mock.calls.length;
    await advance(10_000);
    expect(fetchMock.mock.calls).toHaveLength(callsAtClose);
  });

  it("keeps polling a draft session, starts its challenge when opened, and freezes on confirmed close", async () => {
    let liveAttempt = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/challenge")) {
        return response(challenge({ serverTime: "2026-09-17T10:00:01.000Z" }));
      }
      liveAttempt += 1;
      if (liveAttempt === 1) {
        return response(snapshot({ state: "draft", checkinEndsAt: null }));
      }
      if (liveAttempt === 2) {
        return response(snapshot({
          state: "open",
          serverTime: "2026-09-17T10:00:01.000Z",
          checkinEndsAt: "2026-09-17T10:02:01.000Z",
        }));
      }
      return response(snapshot({
        state: "closed",
        serverTime: "2026-09-17T10:00:02.000Z",
        checkinEndsAt: "2026-09-17T10:02:01.000Z",
      }));
    });

    render(<LiveProjector sessionId={SESSION_ID} />);
    await settle();
    expect(screen.getByText("Në pritje që sesioni të hapet")).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/challenge")))
      .toHaveLength(0);

    await advance(1_000);
    expect(screen.getByAltText("QR për check-in")).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/challenge")))
      .toHaveLength(1);

    await advance(1_000);
    expect(screen.getByText("Check-in u mbyll")).toBeTruthy();
    const callsAtClose = fetchMock.mock.calls.length;
    await advance(10_000);
    expect(fetchMock.mock.calls).toHaveLength(callsAtClose);
  });

  it("withholds a final total when closure cannot be confirmed", async () => {
    let liveAttempt = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).endsWith("/challenge")) {
        return response(challenge({ expiresAt: "2026-09-17T10:00:02.000Z" }));
      }
      liveAttempt += 1;
      if (liveAttempt === 1) {
        return response(snapshot({
          checkinEndsAt: "2026-09-17T10:00:02.000Z",
          entries: [{ rosterId: "one", displayName: "Arta K.", recordedAt: SERVER_TIME }],
          total: 1,
        }));
      }
      throw new TypeError("offline");
    });

    render(<LiveProjector sessionId={SESSION_ID} />);
    await settle();
    expect(screen.getByText("Arta K.")).toBeTruthy();
    await advance(2_000);

    expect(screen.getByText("Check-in u mbyll — rilidhu për totalin")).toBeTruthy();
    expect(screen.queryByText("1", { selector: ".projector-total strong" })).toBeNull();
  });

  it("shows anti-sharing guidance", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).endsWith("/live") ? response(snapshot()) : response(challenge()),
    );
    render(<LiveProjector sessionId={SESSION_ID} />);
    await settle();
    expect(screen.getByText(
      "Mos e shpërndani QR-në. Çdo hyrje shfaqet live dhe regjistrohet me kohën e serverit.",
    )).toBeTruthy();
  });
});

describe("staff administration", () => {
  it("checks current staff membership before rendering the dashboard", async () => {
    staffGate.requireCurrentStaff.mockRejectedValueOnce(
      new Error("Staff access required"),
    );

    render(await StaffPage());

    expect(staffGate.requireCurrentStaff).toHaveBeenCalledOnce();
    expect(screen.getByText("Staff access required")).toBeTruthy();
    expect(screen.queryByText("Semestrat")).toBeNull();
  });

  it("checks current staff membership before rendering the projector", async () => {
    staffGate.requireCurrentStaff.mockRejectedValueOnce(
      new Error("Staff access required"),
    );

    render(await ProjectorPage({ params: Promise.resolve({ sessionId: SESSION_ID }) }));

    expect(staffGate.requireCurrentStaff).toHaveBeenCalledOnce();
    expect(screen.getByText("Staff access required")).toBeTruthy();
    expect(screen.queryByText("Check-in")).toBeNull();
  });

  it("sends audit reasons, imports the roster atomically, creates sessions, and exposes CSV export", async () => {
    const activeId = "44444444-4444-4444-8444-444444444444";
    const draftId = "55555555-5555-4555-8555-555555555555";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/semesters" && (!init?.method || init.method === "GET")) {
        return response([
          { id: activeId, title: "Vjeshtë 2026", weekCount: 15, status: "active" },
          { id: draftId, title: "Pranverë 2027", weekCount: 15, status: "draft" },
        ]);
      }
      if (url === "/api/class-sessions" && (!init?.method || init.method === "GET")) {
        return response([]);
      }
      if (url.endsWith(`/semesters/${draftId}/state`)) {
        return response({ id: draftId, status: "active" });
      }
      if (url === "/api/roster/import") {
        return response({ rows: [] }, 201);
      }
      if (url === "/api/class-sessions") {
        return response({ id: SESSION_ID, title: "Ligjërata 1" }, 201);
      }
      if (url.endsWith(`/class-sessions/${SESSION_ID}/records`)) {
        return response({
          session: {
            id: SESSION_ID,
            title: "Ligjërata 1",
            state: "draft",
            weekNumber: 1,
            kind: "lecture",
            groupName: "G1",
            checkinEndsAt: null,
          },
          records: [],
        });
      }
      return response({});
    });

    render(<SemesterAdmin />);
    await settle();

    const exportLink = screen.getAllByRole("link", { name: "Eksporto CSV" })
      .find((link) => link.getAttribute("href")?.includes(activeId));
    expect(exportLink?.getAttribute("href")).toBe(`/api/semesters/${activeId}/export`);

    fireEvent.change(screen.getByLabelText("Arsyeja për Pranverë 2027"), {
      target: { value: "Fillon semestri" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aktivizo" }));
    await settle();
    const semesterTransition = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith(`/semesters/${draftId}/state`),
    );
    expect(semesterTransition?.[1]?.body).toBe(JSON.stringify({
      state: "active",
      reason: "Fillon semestri",
    }));

    fireEvent.change(screen.getByLabelText("Semestri", { selector: "select" }), {
      target: { value: activeId },
    });
    fireEvent.change(screen.getByLabelText("Student ID, Emri i plotë, Grupi"), {
      target: { value: "A-1, Arta Kola, G1\nB-1, Besa Dema, G1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importo të gjithë rreshtat" }));
    await settle();
    const rosterImport = fetchMock.mock.calls.find(([url]) => String(url) === "/api/roster/import");
    expect(JSON.parse(String(rosterImport?.[1]?.body))).toEqual({
      semesterId: activeId,
      rows: [
        { studentId: "A-1", fullName: "Arta Kola", groupName: "G1" },
        { studentId: "B-1", fullName: "Besa Dema", groupName: "G1" },
      ],
    });

    fireEvent.change(screen.getByLabelText("Semestri aktiv"), { target: { value: activeId } });
    fireEvent.change(screen.getByLabelText("Titulli", { selector: "#session-title" }), { target: { value: "Ligjërata 1" } });
    fireEvent.change(screen.getByLabelText("Java"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Grupi"), { target: { value: "G1" } });
    fireEvent.click(screen.getByRole("button", { name: "Krijo sesionin" }));
    await settle();
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/class-sessions")).toBe(true);
    expect(window.location.pathname + window.location.search).toBe(`/staff?sessionId=${SESSION_ID}`);
    cleanup();
    render(await StaffPage({ searchParams: Promise.resolve({
      sessionId: new URLSearchParams(window.location.search).get("sessionId")!,
    }) }));
    await settle();
    expect(screen.getByText("Ligjërata 1", { selector: "#session-admin-title" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Hap projektorin" }).getAttribute("href"))
      .toBe(`/staff/project/${SESSION_ID}`);
  });

  it("captures forms before requests, resets on success, reports success, and refreshes options", async () => {
    const activeId = "44444444-4444-4444-8444-444444444444";
    let semesterGets = 0;
    let sessionGets = 0;
    let resolveSemester!: (value: Response) => void;
    let resolveRoster!: (value: Response) => void;
    const semesterCreated = new Promise<Response>((resolve) => { resolveSemester = resolve; });
    const rosterImported = new Promise<Response>((resolve) => { resolveRoster = resolve; });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/semesters" && (!init?.method || init.method === "GET")) {
        semesterGets += 1;
        return response([{ id: activeId, title: "Vjeshtë 2026", weekCount: 15, status: "active" }]);
      }
      if (url === "/api/class-sessions" && (!init?.method || init.method === "GET")) {
        sessionGets += 1;
        return response([]);
      }
      if (url === "/api/semesters" && init?.method === "POST") {
        return semesterCreated;
      }
      if (url === "/api/roster/import") {
        return rosterImported;
      }
      return response({});
    });

    render(<SemesterAdmin />);
    await settle();

    const semesterTitle = screen.getByLabelText("Titulli", { selector: "#semester-title" }) as HTMLInputElement;
    fireEvent.change(semesterTitle, { target: { value: "Pranverë 2027" } });
    fireEvent.click(screen.getByRole("button", { name: "Krijo semestrin" }));
    await settle();
    expect(semesterTitle.value).toBe("Pranverë 2027");
    await act(async () => resolveSemester(response({ id: "new", title: "Pranverë 2027" }, 201)));
    await settle();
    expect(semesterTitle.value).toBe("");
    expect(screen.getByText("Semestri u krijua.")).toBeTruthy();
    expect(semesterGets).toBe(2);
    expect(sessionGets).toBe(2);

    const semesterSelect = screen.getByLabelText("Semestri", { selector: "select" }) as HTMLSelectElement;
    const rosterRows = screen.getByLabelText("Student ID, Emri i plotë, Grupi") as HTMLTextAreaElement;
    fireEvent.change(semesterSelect, { target: { value: activeId } });
    fireEvent.change(rosterRows, { target: { value: "A-1, Arta Kola, G1" } });
    fireEvent.click(screen.getByRole("button", { name: "Importo të gjithë rreshtat" }));
    await settle();
    expect(rosterRows.value).toBe("A-1, Arta Kola, G1");
    await act(async () => resolveRoster(response({ rows: [] }, 201)));
    await settle();
    expect(rosterRows.value).toBe("");
    expect(screen.getByText("1 studentë u importuan në një transaksion.")).toBeTruthy();
    expect(semesterGets).toBe(3);
    expect(sessionGets).toBe(3);
  });

  it("lists existing sessions and restores durable private navigation from the URL selection", async () => {
    const activeId = "44444444-4444-4444-8444-444444444444";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/semesters") {
        return response([{ id: activeId, title: "Vjeshtë 2026", weekCount: 15, status: "active" }]);
      }
      if (url === "/api/class-sessions") {
        return response([{
          id: SESSION_ID,
          semesterId: activeId,
          semesterTitle: "Vjeshtë 2026",
          title: "Ligjërata e vjetër",
          state: "closed",
          weekNumber: 3,
          kind: "lecture",
          groupName: "G1",
          checkinEndsAt: "2026-09-17T10:02:00.000Z",
        }]);
      }
      if (url.endsWith(`/class-sessions/${SESSION_ID}/records`)) {
        return response({
          session: {
            id: SESSION_ID,
            title: "Ligjërata e vjetër",
            state: "closed",
            weekNumber: 3,
            kind: "lecture",
            groupName: "G1",
            checkinEndsAt: "2026-09-17T10:02:00.000Z",
          },
          records: [],
        });
      }
      return response({});
    });

    render(await StaffPage({ searchParams: Promise.resolve({ sessionId: SESSION_ID }) }));
    await settle();

    expect(screen.getByRole("link", { name: "Menaxho Ligjërata e vjetër" }).getAttribute("href"))
      .toBe(`/staff?sessionId=${SESSION_ID}`);
    expect(screen.getByText("Ligjërata e vjetër", { selector: "#session-admin-title" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Hap projektorin" }).getAttribute("href"))
      .toBe(`/staff/project/${SESSION_ID}`);
  });
});

describe("private staff session", () => {
  it("loads the staff-only records endpoint and renders full identity fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response({
      session: {
        id: SESSION_ID,
        title: "Ligjërata 1",
        state: "open",
        weekNumber: 1,
        kind: "lecture",
        groupName: "G1",
        checkinEndsAt: "2026-09-17T10:02:00.000Z",
      },
      records: [{
        id: "22222222-2222-4222-8222-222222222222",
        rosterId: "33333333-3333-4333-8333-333333333333",
        fullName: "Arta Kola",
        studentId: "A-1",
        githubUsername: "student-a",
        status: "present",
        recordedAt: SERVER_TIME,
      }],
    }));

    render(<SessionAdmin sessionId={SESSION_ID} />);

    await settle();
    expect(screen.getByText("Arta Kola")).toBeTruthy();
    expect(screen.getByText("A-1")).toBeTruthy();
    expect(screen.getByText("@student-a")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/class-sessions/${SESSION_ID}/records`,
      expect.objectContaining({ cache: "no-store" }),
    );

    fireEvent.change(screen.getByLabelText("Statusi për Arta Kola"), {
      target: { value: "excused" },
    });
    fireEvent.change(screen.getByLabelText("Arsyeja për Arta Kola"), {
      target: { value: "Arsyetim i aprovuar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ruaj Arta Kola" }));
    await settle();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/records/22222222-2222-4222-8222-222222222222",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("refreshes an open roster, preserves edits, and reconciles a concurrent student check-in", async () => {
    const rosterId = "33333333-3333-4333-8333-333333333333";
    const recordId = "22222222-2222-4222-8222-222222222222";
    let recordsGet = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/records") && (!init?.method || init.method === "GET")) {
        recordsGet += 1;
        return response({
          session: {
            id: SESSION_ID,
            title: "Ligjërata 1",
            state: "open",
            weekNumber: 1,
            kind: "lecture",
            groupName: "G1",
            checkinEndsAt: "2026-09-17T10:02:00.000Z",
          },
          records: [{
            id: recordsGet === 1 ? null : recordId,
            rosterId,
            fullName: "Arta Kola",
            studentId: "A-1",
            githubUsername: "student-a",
            status: recordsGet === 1 ? "absent" : "present",
            recordedAt: recordsGet === 1 ? null : SERVER_TIME,
          }],
        });
      }
      return response({ id: recordId, status: "excused" });
    });

    render(<SessionAdmin sessionId={SESSION_ID} />);
    await settle();
    expect(screen.getByText("Pa regjistrim")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Statusi për Arta Kola"), {
      target: { value: "excused" },
    });
    fireEvent.change(screen.getByLabelText("Arsyeja për Arta Kola"), {
      target: { value: "Arsyetim në shqyrtim" },
    });

    await advance(1_000);
    expect(recordsGet).toBe(2);
    expect(screen.queryByText("Pa regjistrim")).toBeNull();
    expect(screen.getByText("I pranishëm", { selector: "span" })).toBeTruthy();
    expect((screen.getByLabelText("Statusi për Arta Kola") as HTMLSelectElement).value)
      .toBe("excused");
    expect((screen.getByLabelText("Arsyeja për Arta Kola") as HTMLInputElement).value)
      .toBe("Arsyetim në shqyrtim");

    fireEvent.click(screen.getByRole("button", { name: "Ruaj Arta Kola" }));
    await settle();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/records/${recordId}`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("reconciles untouched status controls and stops refreshing on confirmed closure", async () => {
    let reads = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      reads += 1;
      return response({
        session: { id: SESSION_ID, title: "Ligjërata 1", state: reads < 3 ? "open" : "closed",
          weekNumber: 1, kind: "lecture", groupName: "G1", checkinEndsAt: null },
        records: [{ id: "record", rosterId: "roster", fullName: "Arta Kola", studentId: "A-1",
          githubUsername: "student-a", status: reads === 1 ? "present" : "excused", recordedAt: SERVER_TIME }],
      });
    });
    render(<SessionAdmin sessionId={SESSION_ID} />);
    await settle();
    const status = screen.getByLabelText("Statusi për Arta Kola") as HTMLSelectElement;
    expect(status.value).toBe("present");
    await advance(1_000);
    expect(status.value).toBe("excused");
    await advance(1_000);
    expect(screen.getByText("Java 1 · G1 · closed")).toBeTruthy();
    await advance(5_000);
    expect(reads).toBe(3);
  });

  it("reloads records when a manual insert races with a student check-in", async () => {
    const rosterId = "33333333-3333-4333-8333-333333333333";
    const recordId = "22222222-2222-4222-8222-222222222222";
    let recordsGet = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/records") && (!init?.method || init.method === "GET")) {
        recordsGet += 1;
        return response({
          session: {
            id: SESSION_ID,
            title: "Ligjërata 1",
            state: "open",
            weekNumber: 1,
            kind: "lecture",
            groupName: "G1",
            checkinEndsAt: "2026-09-17T10:02:00.000Z",
          },
          records: [{
            id: recordsGet === 1 ? null : recordId,
            rosterId,
            fullName: "Arta Kola",
            studentId: "A-1",
            githubUsername: "student-a",
            status: recordsGet === 1 ? "absent" : "present",
            recordedAt: recordsGet === 1 ? null : SERVER_TIME,
          }],
        });
      }
      if (url.endsWith("/records") && init?.method === "POST") {
        return response({ error: { code: "record_exists", message: "Attendance record already exists" } }, 409);
      }
      return response({ id: recordId, status: "excused" });
    });

    render(<SessionAdmin sessionId={SESSION_ID} />);
    await settle();
    fireEvent.change(screen.getByLabelText("Arsyeja për Arta Kola"), {
      target: { value: "Shtim manual" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ruaj Arta Kola" }));
    await settle();

    expect(recordsGet).toBe(2);
    expect(screen.getByRole("status").textContent).toContain("rifreskua");
    fireEvent.change(screen.getByLabelText("Statusi për Arta Kola"), {
      target: { value: "excused" },
    });
    fireEvent.change(screen.getByLabelText("Arsyeja për Arta Kola"), {
      target: { value: "Korrigjim pas check-in" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ruaj Arta Kola" }));
    await settle();
    expect(vi.mocked(fetch).mock.calls.some(([url, init]) =>
      String(url) === `/api/records/${recordId}` && init?.method === "PATCH",
    )).toBe(true);
  });
});
