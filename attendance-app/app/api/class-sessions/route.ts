import { z } from "zod";

import {
  attendanceService,
  attendanceServiceErrorResponse,
} from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";

const sessionSchema = z.object({
  semesterId: z.string().uuid(),
  weekNumber: z.number().int().positive().max(52),
  kind: z.enum(["lecture", "lab"]),
  groupName: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const rawSemesterId = new URL(request.url).searchParams.get("semesterId");
    const semesterId = rawSemesterId
      ? z.string().uuid().safeParse(rawSemesterId)
      : null;
    if (semesterId && !semesterId.success) {
      return invalidRequest();
    }
    return Response.json(
      await attendanceService.listClassSessions(
        await getCurrentSession(),
        semesterId?.data,
      ),
    );
  } catch (error) {
    return attendanceServiceErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = sessionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return invalidRequest();
    }
    const result = await attendanceService.createClassSession(
      await getCurrentSession(),
      parsed.data,
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return attendanceServiceErrorResponse(error);
  }
}

function invalidRequest(): Response {
  return Response.json(
    { error: { code: "invalid_request", message: "Invalid request" } },
    { status: 400 },
  );
}
