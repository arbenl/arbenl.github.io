import { z } from "zod";

import {
  attendanceService,
  attendanceServiceErrorResponse,
  firstForwardedIp,
} from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";

const activationSchema = z.object({
  semesterId: z.string().uuid(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  groupName: z.enum(["G1", "G2"]).optional(),
  beforeClass: z.boolean().optional(),
  registrationPermit: z.string().max(1500).optional(),
  token: z.string().regex(/^[0-9a-f]{64}$/u).optional(),
  studentId: z.string().trim().min(1).max(100),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = activationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return invalidRequest();
    }
    const result = await attendanceService.activateRoster(
      await getCurrentSession(),
      parsed.data,
      firstForwardedIp(request),
    );
    return Response.json(result);
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
