import { redirectProfessor } from "../../../lib/auth/role-entry";
import { ProfileForm } from "@/components/profile-form";

export const dynamic = "force-dynamic";
export default async function ActivateStudentPage() {
  await redirectProfessor();
  return (
    <main className="page-shell" id="permbajtja-kryesore">
      <section className="status-card student-card" aria-labelledby="activation-title">
        <p className="eyebrow">Profili i studentit</p>
        <h1 id="activation-title">Aktivizo profilin</h1>
        <p>Ky formular me GitHub është opsional. Pa GitHub, skano QR-në aktive të profesorit në klasë dhe regjistrohu me emailin tënd.</p>
        <p>Plotësoje një herë, para orës ose pas skanimit të parë. Profili ruhet për semestrin; pjesëmarrjen e konfirmon me QR në çdo orë.</p>
        <ProfileForm beforeClass />
      </section>
    </main>
  );
}
