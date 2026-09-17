import { z } from "zod";

import {
  attendanceService,
  attendanceServiceErrorResponse,
} from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";

const recordSchema = z.object({
  rosterId: z.string().uuid(),
  status: z.enum(["present", "rejected", "excused"]),
  reason: z.string().trim().min(1).max(500),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const [{ id }, body] = await Promise.all([context.params, request.json()]);
    const identifier = z.string().uuid().safeParse(id);
    const parsed = recordSchema.safeParse(body);
    if (!identifier.success || !parsed.success) {
      return invalidRequest();
    }
    const result = await attendanceService.createManualRecord(
      await getCurrentSession(),
      identifier.data,
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
