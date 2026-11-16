import {
  completeGitHubLink,
  LINK_COOKIE,
} from "../../../../lib/attendance/github-link";
import NextAuth from "next-auth";
import type { NextRequest } from "next/server";

import { getAuthOptions } from "../../../../lib/auth/options";

interface AuthRouteContext {
  params: Promise<{ nextauth: string[] }>;
}

async function handler(request: NextRequest, context: AuthRouteContext) {
  const token = request.cookies.get(LINK_COOKIE)?.value;
  const callback = request.nextUrl.pathname.endsWith("/callback/github");
  const oauthStart = request.nextUrl.pathname.endsWith("/signin/github");
  // An abandoned optional student link must not intercept a later normal login.
  // Clone the body: NextAuth still needs the original CSRF and callback fields.
  const explicitLink = oauthStart && request.method === "POST" &&
    (await request.clone().formData().catch(() => null))?.get("linkIntent") === "student-github";
  const response = await NextAuth(
    request,
    context,
    getAuthOptions(
      callback && token
        ? (record) => completeGitHubLink(token, record)
        : undefined,
    ),
  );
  if (token && (callback || (oauthStart && !explicitLink)))
    response.headers.append(
      "set-cookie",
      `${LINK_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
  return response;
}

export { handler as GET, handler as POST };
