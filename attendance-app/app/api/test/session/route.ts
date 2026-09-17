import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthOptions } from "@/lib/auth/options";

export const dynamic = "force-dynamic";

const identities = {
  professor: { githubId: "900000001", githubLogin: "e2e-professor", name: "E2E Professor" },
  studentOne: { githubId: "900000002", githubLogin: "e2e-arta", name: "Arta Kola" },
  studentTwo: { githubId: "900000003", githubLogin: "e2e-besa", name: "Besa Duka" },
} as const;

export async function POST(request: Request): Promise<Response> {
  // Check before parsing input, loading environment configuration, or touching DB/auth.
  // VERCEL="" is still a deployment environment; only its absence is allowed.
  if (process.env.E2E_TEST_AUTH !== "1" || process.env.VERCEL !== undefined) {
    return new Response(null, { status: 404 });
  }

  const input = z.object({ persona: z.enum(["professor", "studentOne", "studentTwo"]) })
    .strict().safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: "Invalid synthetic identity" }, { status: 400 });
  }

  const identity = identities[input.data.persona];
  const [{ db }, { users }] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);
  await db.insert(users).values({
    githubId: identity.githubId,
    githubUsername: identity.githubLogin,
    name: identity.name,
  }).onConflictDoUpdate({
    target: users.githubId,
    set: { githubUsername: identity.githubLogin, name: identity.name },
  });

  const auth = getAuthOptions();
  const cookie = auth.cookies!.sessionToken!;
  const maxAge = 60 * 60;
  const token = await encode({
    secret: auth.secret!,
    maxAge,
    token: { ...identity, sub: identity.githubId },
  });
  const response = NextResponse.json({ githubId: identity.githubId });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(cookie.name, token, { ...cookie.options, maxAge });
  return response;
}
