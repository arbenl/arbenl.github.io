import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StudentPage from "../../app/student/page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/student?userId=student-b");
});

afterEach(cleanup);

describe("student semester history", () => {
  it("requests session-derived history and renders only the authenticated response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        sessions: [
          {
            id: "session-a",
            semesterTitle: "Vjeshtë 2026",
            title: "Ligjërata 1",
            weekNumber: 1,
            kind: "lecture",
            status: "present",
            recordedAt: "2026-09-17T10:00:00.000Z",
          },
        ],
        totals: { sessions: 3, present: 1, excused: 1, rejected: 1, absent: 0 },
      }),
    );

    const view = render(<StudentPage />);

    await waitFor(() => expect(view.getByText("Ligjërata 1")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/student/history", expect.objectContaining({
      cache: "no-store",
    }));
    expect(view.container.textContent).toContain("Vjeshtë 2026");
    expect(view.container.textContent).toContain("QR-ja shfaqet nga profesori në projektor");
    expect(view.container.textContent).toContain("kamerën e telefonit");
    expect(view.container.textContent).toContain("1 e pranishme");
    expect(view.container.textContent).toContain("1 e arsyetuar");
    expect(view.container.textContent).toContain("1 e refuzuar");
    expect(view.container.textContent).not.toContain("Besa Dema");
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("student-b");
  });
});

it("shows the saved profile and keeps an open class pending instead of absent", async () => {
  vi.spyOn(globalThis,"fetch").mockResolvedValue(jsonResponse({
    profile:{fullName:"Arta Kola",studentId:"001",email:"arta@example.com",groupName:"G1"},
    sessions:[{id:"open",semesterTitle:"Mobile 2026/27",title:"Ushtrimet 2",weekNumber:2,kind:"lab",status:"pending",recordedAt:null}],
    totals:{sessions:0,present:0,excused:0,rejected:0,absent:0,pending:1},
  }));
  const view=render(<StudentPage />);
  await waitFor(()=>expect(view.getByText("Regjistrimi është i hapur")).toBeTruthy());
  expect(view.getByText("Arta Kola · G1")).toBeTruthy();
  expect(view.queryByText("Mungesë",{exact:true})).toBeNull();
  expect(view.queryByText("Regjistrohu një herë →")).toBeNull();
});
it("provides a clear recovery action when history cannot load",async()=>{
  vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("offline"));
  const view=render(<StudentPage />);
  await waitFor(()=>expect(view.getByRole("alert")).toBeTruthy());
  expect(view.getByRole("button",{name:"Provo përsëri"})).toBeTruthy();
});
