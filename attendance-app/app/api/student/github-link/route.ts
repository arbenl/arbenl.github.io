import { NextResponse } from "next/server";
import { getCurrentSession } from "../../../../lib/auth/session";
import { getEnv } from "../../../../lib/env";
import {
  beginGitHubLink,
  studentGitHubProfile,
  saveStudentRepository,
  LINK_COOKIE,
} from "../../../../lib/attendance/github-link";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      await studentGitHubProfile(await getCurrentSession()),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "student_required" }, { status: 403 });
  }
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(getEnv().NEXTAUTH_URL).origin)
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const data = await request.json();
    const session = await getCurrentSession();
    if (data.action === "start") {
      const token = await beginGitHubLink(session);
      const response = NextResponse.json(
        { ready: true },
        { headers: { "Cache-Control": "no-store" } },
      );
      response.cookies.set(LINK_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      return response;
    }
    if (
      data.action === "repository" &&
      typeof data.url === "string" &&
      data.url.length <= 300
    )
      return NextResponse.json(await saveStudentRepository(session, data.url), {
        headers: { "Cache-Control": "no-store" },
      });
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "link_failed" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
