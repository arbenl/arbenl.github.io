import {
  attendanceService,
  attendanceServiceErrorResponse,
} from "@/lib/attendance/service";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET(_request: Request): Promise<Response> {
  void _request;
  try {
    return Response.json(
      await attendanceService.getStudentHistory(await getCurrentSession()),
    );
  } catch (error) {
    return attendanceServiceErrorResponse(error);
  }
}
