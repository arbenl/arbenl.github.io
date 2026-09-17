import { z } from "zod";

import {
  attendanceService,
  attendanceServiceErrorResponse,
} from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";

const correctionSchema = z.object({
  status: z.enum(["present", "rejected", "excused"]),
  reason: z.string().trim().min(1).max(500),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const [{ id }, body] = await Promise.all([context.params, request.json()]);
    const identifier = z.string().uuid().safeParse(id);
    const parsed = correctionSchema.safeParse(body);
    if (!identifier.success || !parsed.success) {
      return invalidRequest();
    }
    return Response.json(
      await attendanceService.correctRecord(
        await getCurrentSession(),
        identifier.data,
        parsed.data,
      ),
    );
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
