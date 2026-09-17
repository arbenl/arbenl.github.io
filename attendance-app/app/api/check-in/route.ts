import { z } from "zod";

import {
  attendanceService,
  attendanceServiceErrorResponse,
  firstForwardedIp,
} from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";

const checkInSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/u),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = checkInSchema.safeParse(await request.json());
    if (!parsed.success) {
      return invalidRequest();
    }
    return Response.json(
      await attendanceService.checkIn(
        await getCurrentSession(),
        parsed.data,
        firstForwardedIp(request),
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
