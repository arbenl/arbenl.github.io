import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const boundary = vi.hoisted(() => ({ nextAuth: vi.fn(), options: vi.fn((link?: unknown) => ({link})), link: vi.fn() }));
vi.mock("next-auth", () => ({ default: boundary.nextAuth }));
vi.mock("../lib/auth/options", () => ({ getAuthOptions: boundary.options }));
vi.mock("../lib/attendance/github-link", () => ({ LINK_COOKIE: "student-github-link", completeGitHubLink: boundary.link }));
import { POST, GET } from "../app/api/auth/[...nextauth]/route";
const context = { params: Promise.resolve({ nextauth: ["signin", "github"] }) };
beforeEach(() => { boundary.nextAuth.mockResolvedValue(new NextResponse("ok")); });
afterEach(() => vi.clearAllMocks());
describe("GitHub link intent isolation", () => {
  it("discards an abandoned student link before ordinary GitHub sign-in", async () => {
    const response = await POST(new NextRequest("https://course.example/api/auth/signin/github", {method:"POST",headers:{cookie:"student-github-link=abandoned","content-type":"application/x-www-form-urlencoded"},body:"callbackUrl=%2Fstaff&csrfToken=test"}), context);
    expect(response.headers.get("set-cookie")).toContain("student-github-link=; Path=/; Max-Age=0");
  });
  it("preserves a deliberate self-link through the OAuth start", async () => {
    const response = await POST(new NextRequest("https://course.example/api/auth/signin/github", {method:"POST",headers:{cookie:"student-github-link=active","content-type":"application/x-www-form-urlencoded"},body:"linkIntent=student-github&csrfToken=test"}), context);
    expect(response.headers.get("set-cookie")).toBeNull();
    const request = boundary.nextAuth.mock.calls[0][0] as NextRequest;
    expect((await request.formData()).get("csrfToken")).toBe("test");
  });
  it("consumes the link cookie after the provider callback even if it was rejected", async () => {
    const response = await GET(new NextRequest("https://course.example/api/auth/callback/github?code=test", {headers:{cookie:"student-github-link=active"}}), context);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(boundary.options.mock.calls[0][0]).toBeTypeOf("function");
  });
});
