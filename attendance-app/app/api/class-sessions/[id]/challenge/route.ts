import { z } from "zod";

import {
  attendanceService,
  attendanceServiceErrorResponse,
  firstForwardedIp,
} from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const identifier = z.string().uuid().safeParse((await context.params).id);
    if (!identifier.success) {
      return invalidRequest();
    }
    return Response.json(
      await attendanceService.createChallenge(
        await getCurrentSession(),
        identifier.data,
        firstForwardedIp(request),
      ),
      { status: 201 },
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
