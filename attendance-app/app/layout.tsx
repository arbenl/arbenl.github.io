import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mobile 2026/2027 · Vijueshmëria · AAB",
  description: "Programimi për Pajisje Mobile · Semestri dimëror 2026/2027 · Ligjërata dhe ushtrime.",
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
                <small>2026/2027 · Vijueshmëria</small>
              </span>
            </Link>
            <nav className="app-nav" aria-label="Navigimi kryesor">
              <a href="https://arbenl.github.io/lendet/2026-2027/mobile/">Materialet e lëndës</a>
              <Link href="/student">Vijueshmëria ime</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
