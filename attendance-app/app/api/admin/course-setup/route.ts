import {
  attendanceService,
  attendanceServiceErrorResponse,
} from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";

export async function POST(): Promise<Response> {
  try {
    return Response.json(
      await attendanceService.ensureCurrentCourseSetup(await getCurrentSession()),
    );
  } catch (error) {
    return attendanceServiceErrorResponse(error);
  }
}
