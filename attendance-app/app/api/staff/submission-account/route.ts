import { getCurrentSession } from "../../../../lib/auth/session";
import { getEnv } from "../../../../lib/env";
import { verifySubmissionAccount } from "../../../../lib/attendance/submission-accounts";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(getEnv().NEXTAUTH_URL).origin)
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const data = await request.json();
    const result = await verifySubmissionAccount(
      await getCurrentSession(),
      data,
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      {
        error:
          "Dorëzimi nuk u lidh. Kontrollo burimin dhe profilin; llogaria nuk mund të jetë e një studenti tjetër.",
      },
      { status: 403 },
    );
  }
}
