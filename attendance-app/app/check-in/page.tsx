import { redirectProfessor } from "../../lib/auth/role-entry";
import { CheckInResult } from "@/components/check-in-result";

export const dynamic = "force-dynamic";
export default async function CheckInPage() {
  await redirectProfessor();
  return (
    <main className="page-shell" id="permbajtja-kryesore">
      <section className="status-card student-card" aria-labelledby="check-in-title">
        <p className="eyebrow">Vijueshmëria live</p>
        <h1 id="check-in-title">Check-in</h1>
        <CheckInResult />
      </section>
    </main>
  );
}
