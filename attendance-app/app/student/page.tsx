import StudentHistory from "../../components/student-history";
import { redirectProfessor } from "../../lib/auth/role-entry";
export const dynamic = "force-dynamic";
export default async function StudentPage() {
  await redirectProfessor();
  return <StudentHistory />;
}
