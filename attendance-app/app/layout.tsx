import type { Metadata } from "next";

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
        {children}
      </body>
    </html>
  );
}
