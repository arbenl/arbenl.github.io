import { CheckInResult } from "@/components/check-in-result";

export default function CheckInPage() {
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
