import { z } from "zod";

import {
  attendanceService,
  attendanceServiceErrorResponse,
} from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";

const semesterSchema = z.object({
  title: z.string().trim().min(1).max(200),
  weekCount: z.number().int().positive().max(52),
});

export async function GET(): Promise<Response> {
  try {
    return Response.json(
      await attendanceService.listSemesters(await getCurrentSession()),
    );
  } catch (error) {
    return attendanceServiceErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = semesterSchema.safeParse(await request.json());
    if (!parsed.success) {
      return invalidRequest();
    }
    const result = await attendanceService.createSemester(
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
