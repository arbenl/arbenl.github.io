import { redirect } from "next/navigation";
import { AuthorizationError, requireCurrentStaff } from "./session";

/** Keep the professor out of student-only forms without treating outages as students. */
export async function redirectProfessor() {
  try {
    await requireCurrentStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return;
    throw error;
  }
  redirect("/staff");
}
