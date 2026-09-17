import { z } from "zod";

import {
  attendanceService,
  attendanceServiceErrorResponse,
} from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";

const rosterImportSchema = z.object({
  semesterId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        studentId: z.string().trim().min(1).max(100),
        fullName: z.string().trim().min(1).max(200),
        groupName: z.string().trim().min(1).max(100),
      }),
    )
    .min(1)
    .max(2_000),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = rosterImportSchema.safeParse(await request.json());
    if (!parsed.success) {
      return invalidRequest();
    }
    const result = await attendanceService.importRoster(
      await getCurrentSession(),
      parsed.data,
    );
    return Response.json({ rows: result }, { status: 201 });
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
