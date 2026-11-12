import { getCurrentSession } from "../../../../lib/auth/session";
import { getEnv } from "../../../../lib/env";
import { createStudentAccessCode } from "../../../../lib/attendance/student-access";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(getEnv().NEXTAUTH_URL).origin)
    return Response.json({ error: "Hyrje e palejuar" }, { status: 403 });
  try {
    return Response.json(
      await createStudentAccessCode(await getCurrentSession()),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Hap profilin tënd të regjistruar për të marrë kodin." },
      { status: 403 },
    );
  }
}
