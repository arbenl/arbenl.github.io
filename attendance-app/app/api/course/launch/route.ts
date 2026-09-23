import { z } from "zod";
import { attendanceService, attendanceServiceErrorResponse } from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.NEXTAUTH_URL ?? request.url).origin) {
    return Response.json({ error: { message: "Origin not allowed" } }, { status: 403 });
  }
  const input = z.object({ week: z.number().int().min(1).max(15), kind: z.enum(["lecture", "lab"]), group: z.enum(["G1", "G2"]).optional() })
    .safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: { message: "Ora nuk është e vlefshme." } }, { status: 400 });
  try {
    const session = await attendanceService.launchCourseSession(await getCurrentSession(), input.data.week, input.data.kind, input.data.group);
    return Response.json({ sessionId: session.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return attendanceServiceErrorResponse(error); }
}
