import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Vijueshmëria live",
  description: "Aplikacioni i vijueshmërisë për ligjërata dhe ushtrime.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sq">
      <body>
        <a className="skip-link" href="#permbajtja-kryesore">
          Kalo te përmbajtja kryesore
        </a>
        <header className="app-header">
          <div className="app-header-inner">
            <Link className="app-brand" href="/">
              <span className="aab-mark" aria-hidden="true">AAB</span>
              <span className="app-brand-copy">
                <strong>Programimi për Pajisje Mobile</strong>
                <small>Student Zone · Vijueshmëria</small>
              </span>
            </Link>
            <nav className="app-nav" aria-label="Navigimi kryesor">
              <a href="https://arbenl.github.io/">Student Zone</a>
              <Link href="/student">Vijueshmëria ime</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
