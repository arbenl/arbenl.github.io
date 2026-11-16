import Link from "next/link";
import { SignIn } from "../../components/sign-in";
import { SwitchAccount } from "../../components/student-access";
import { getCurrentSession, AuthorizationError, requireStaff } from "../../lib/auth/session";
import { signInDestination } from "../../lib/auth/destination";
import { getEnv } from "../../lib/env";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const destination = signInDestination(params.callbackUrl, getEnv().NEXTAUTH_URL);
  const professor = destination === "/staff" || destination.startsWith("/staff/") || destination.startsWith("/staff?");
  const session = await getCurrentSession();
  let verifiedProfessor = false;
  if (session?.user) {
    try { await requireStaff(session); verifiedProfessor = true; }
    catch (error) { if (!(error instanceof AuthorizationError)) throw error; }
  }
  if (!params.error && verifiedProfessor) redirect(professor ? destination : "/staff");
  return <main className="page-shell" id="permbajtja-kryesore"><section className="status-card student-card">
    <p className="eyebrow">Programimi për Pajisje Mobile · 2026/2027</p>
    <h1>{professor ? "Hyrja e profesorit" : "Hyrja e studentit"}</h1>
    <p>{professor ? "Hyr me llogarinë GitHub të autorizuar të profesorit. Pas hyrjes vazhdon te paneli ose ora që zgjodhe." : "Hyr me GitHub-in e lidhur me profilin tënd. Në klasë mund të regjistrohesh edhe me QR dhe email."}</p>
    {params.error && <p role="alert">Hyrja nuk përfundoi. Kontrollo llogarinë e zgjedhur në GitHub dhe provo përsëri.</p>}
    {session?.user && <div className="student-checkin-guide">
      <p>Aktualisht je i kyçur si <strong>{session.user.name ?? session.user.githubLogin ?? "përdorues"}</strong>{session.user.githubLogin ? ` (@${session.user.githubLogin})` : ""}.</p>
      {professor && !verifiedProfessor && <p>Kjo llogari nuk ka qasje si profesor. Ndërro llogarinë dhe në GitHub zgjidh llogarinë e profesorit.</p>}
      {!professor && <p><Link href={destination}>Vazhdo me këtë llogari →</Link></p>}
      <SwitchAccount callbackUrl={`/signin?callbackUrl=${encodeURIComponent(destination)}`} />
    </div>}
    <SignIn callbackUrl={destination} />
    <p><Link href={professor ? "/progress" : "/staff"}>{professor ? "Jam student · Hap kartën" : "Jam profesor · Hap panelin"}</Link></p>
    <p><a href="https://arbenl.github.io/lendet/2026-2027/mobile/#javet">Hap materialet e lëndës →</a></p>
  </section></main>;
}
