import { ProfileForm } from "@/components/profile-form";

export default function ActivateStudentPage() {
  return (
    <main className="page-shell" id="permbajtja-kryesore">
      <section className="status-card student-card" aria-labelledby="activation-title">
        <p className="eyebrow">Profili i studentit</p>
        <h1 id="activation-title">Aktivizo profilin</h1>
        <ProfileForm />
      </section>
    </main>
  );
}
