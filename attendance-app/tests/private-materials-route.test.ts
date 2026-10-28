import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, requireCurrentStaff } from "../lib/auth/session";
import { readPrivateMaterial } from "../lib/materials/week-07";
import { GET } from "../app/api/staff/materials/week-07/[file]/route";

vi.mock("../lib/auth/session",async original=>({...await original<typeof import("../lib/auth/session")>(),requireCurrentStaff:vi.fn()}));
vi.mock("../lib/materials/week-07",()=>({readPrivateMaterial:vi.fn()}));
const request=(file="ushtrimet.html")=>GET(new Request("http://localhost/api/staff/materials/week-07/"+file),{params:Promise.resolve({file})});
afterEach(()=>vi.resetAllMocks());
describe("teacher-only material responses",()=>{
 it.each([401,403] as const)("denies %s before accessing any private content",async status=>{
  vi.mocked(requireCurrentStaff).mockRejectedValue(new AuthorizationError("Denied",status));
  const response=await request();expect(response.status).toBe(status);expect(readPrivateMaterial).not.toHaveBeenCalled();expect(response.headers.get("cache-control")).toContain("no-store");expect(await response.text()).not.toContain("Private test lesson");
 });
 it("serves authenticated HTML and downloads with private response headers",async()=>{
  vi.mocked(requireCurrentStaff).mockResolvedValue({githubId:"1",githubLogin:"arbenl",userId:"teacher",role:"professor"});
  vi.mocked(readPrivateMaterial).mockReturnValue({mime:"text/html; charset=utf-8",bytes:Buffer.from("Private test lesson")});
  const response=await request();expect(response.status).toBe(200);expect(await response.text()).toBe("Private test lesson");expect(response.headers.get("cache-control")).toContain("private");expect(response.headers.get("vary")).toBe("Cookie");expect(response.headers.get("x-robots-tag")).toContain("noindex");
  const file=await request("java-07-model.md");expect(file.headers.get("content-disposition")).toBe('attachment; filename="java-07-model.md"');
 });
 it("returns 404 for unknown files and fails closed when the encryption key is unavailable",async()=>{
  vi.mocked(requireCurrentStaff).mockResolvedValue({githubId:"1",githubLogin:"arbenl",userId:"teacher",role:"professor"});
  vi.mocked(readPrivateMaterial).mockReturnValue(null);expect((await request("bad")).status).toBe(404);
  vi.mocked(readPrivateMaterial).mockImplementation(()=>{throw new Error("do not leak this secret")});
  const response=await request();expect(response.status).toBe(503);expect(await response.text()).not.toContain("secret");
 });
});
