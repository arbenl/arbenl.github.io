import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ report: vi.fn(), submissions: vi.fn() }));
vi.mock("../../lib/auth/session", () => ({ getCurrentSession: async () => ({ user: { githubId: "200", githubLogin: "student" } }) }));
vi.mock("../../lib/attendance/service", async importOriginal => ({ ...await importOriginal<typeof import("../../lib/attendance/service")>(), attendanceService: { getCourseActivityReport: mocks.report } }));
vi.mock("../../lib/attendance/submissions", () => ({ loadSubmissions: mocks.submissions }));
import CourseReportPage from "../../app/report/page";
import { AttendanceServiceError } from "../../lib/attendance/service";
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

describe("shared weekly course report", () => {
  it("renders 80 students, confirmed attendance and submissions without private profile fields", async () => {
    mocks.report.mockResolvedValue({ students: Array.from({length:80}, (_,i) => ({rosterId:String(i), fullName:`Student ${i+1}`, groupName:"G1", githubId:String(1000+i)})), sessions:[{id:"lecture",week:3,kind:"lecture",groupName:"G1",title:"Lecture",state:"closed"}], present:[{rosterId:"0",sessionId:"lecture"}] });
    mocks.submissions.mockResolvedValue([{githubId:"1000",login:"student",week:3,number:50,url:"https://github.com/arbenl/arbenl-mobile-assignments-2026-2027/issues/50"}, {githubId:"9000",login:"unlinked",week:3,number:51,url:"https://github.com/arbenl/arbenl-mobile-assignments-2026-2027/issues/51"}]);
    render(await CourseReportPage({searchParams:Promise.resolve({week:"3"})}));
    expect(screen.getAllByRole("row")).toHaveLength(81);
    expect(screen.getByRole("link",{name:"Dorëzuar · #50"}).getAttribute("href")).toContain("/issues/50");
    expect(screen.getByText("Po")).toBeTruthy();
    expect(screen.getByText("Student 80")).toBeTruthy();
    expect(screen.getByText("unlinked · Dorëzuar #51")).toBeTruthy();
    expect(screen.queryByRole("columnheader",{name:"Student ID"})).toBeNull();
  });
  it("does not call GitHub or render names when access is denied", async () => {
    mocks.report.mockRejectedValue(new AttendanceServiceError(403,"staff_required","Forbidden"));
    render(await CourseReportPage({searchParams:Promise.resolve({})}));
    expect(screen.getByRole("link",{name:"Hyr me GitHub"})).toBeTruthy();
    expect(mocks.submissions).not.toHaveBeenCalled();
    expect(screen.queryByRole("table")).toBeNull();
  });
  it("shows unknown rather than missing submissions when GitHub fails", async () => {
    mocks.report.mockResolvedValue({students:[{rosterId:"1", fullName:"Arta Test",groupName:"G1",githubId:"200"}],sessions:[],present:[]});
    mocks.submissions.mockRejectedValue(new Error("GitHub unavailable"));
    render(await CourseReportPage({searchParams:Promise.resolve({week:"4"})}));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getAllByText("E panjohur").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nuk u gjet")).toBeNull();
  });
  it('shows the same cumulative percentage when viewing different weekly reports', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));
    mocks.report.mockResolvedValue({students:[{rosterId:'1',fullName:'Arta Test',groupName:'G1',githubId:'200'}],sessions:[],present:[]});
    mocks.submissions.mockResolvedValue([1,2,3,7,8].map(week=>({githubId:'200',login:'arta',week,number:week,url:`https://github.com/example/course/issues/${week}`})));
    let view = render(await CourseReportPage({searchParams:Promise.resolve({week:'3'})}));
    expect(screen.getByRole('columnheader',{name:'Dorëzimet totale deri tani'})).toBeTruthy();
    expect(screen.getByText('57%')).toBeTruthy();
    expect(screen.getByText('4/7 javë')).toBeTruthy();
    view.unmount();
    view = render(await CourseReportPage({searchParams:Promise.resolve({week:'15'})}));
    expect(screen.getByText('57%')).toBeTruthy();
    expect(screen.getByText('4/7 javë')).toBeTruthy();
    view.unmount();
  });
  it('keeps an unlinked student unknown rather than assigning a false zero', async () => {
    mocks.report.mockResolvedValue({students:[{rosterId:'1',fullName:'Arta Test',groupName:'G1',githubId:null}],sessions:[],present:[]});
    mocks.submissions.mockResolvedValue([]);
    render(await CourseReportPage({searchParams:Promise.resolve({week:'7'})}));
    expect(screen.getByText('Profili pa lidhje GitHub')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
  });
});
