import Link from "next/link";
import { requireCurrentStaff } from "../../../../lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Java 7 · Materialet e profesorit", robots: { index: false, follow: false } };

export default async function WeekSevenMaterials() {
  try { await requireCurrentStaff(); } catch {
    return <main className="page-shell" id="permbajtja-kryesore"><section className="status-card">
      <p className="eyebrow">Programimi për Pajisje Mobile · 2026/2027</p>
      <h1>Materialet hapen vetëm nga profesori</h1>
      <p>Hyr me llogarinë GitHub të autorizuar të Arben Lila.</p>
      <Link className="admin-link" href="/api/auth/signin?callbackUrl=/staff/materials/week-07">Hyr si profesor</Link>
    </section></main>;
  }
  const base = "/api/staff/materials/week-07/";
  return <main className="page-shell" id="permbajtja-kryesore"><section className="status-card">
    <p className="eyebrow">Vetëm për profesorin · Mobile 2026/2027</p>
    <h1>Java 7 · Ushtrimet</h1>
    <p>Materialet janë të hapura për ty sot. Studentët i hapin nga faqja e lëndës më 29.10.2026, nga ora 14:40.</p>
    <p><a className="admin-link" href={base + "prezantimi-ushtrimeve.html"}>Hap prezantimin e ushtrimeve →</a></p>
    <p><a className="admin-link" href={base + "ushtrimet.html"}>Hap udhëzimin e plotë · 90 minuta →</a></p>
    <p><a className="admin-link" href={base + "ushtrimet-07-kontrolli-mvp-rideshare-2026.pptx"}>Shkarko PowerPoint-in e ushtrimeve</a></p>
    <p><a className="admin-link" href={base + "java-07-model.md"}>Shkarko modelin e raportit</a></p>
    <p><Link href="/staff">← Paneli i profesorit</Link></p>
  </section></main>;
}
