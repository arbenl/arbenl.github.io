import { classroomRegistrationReady } from "@/lib/attendance/classroom-registration";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(
    { enabled: await classroomRegistrationReady() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
