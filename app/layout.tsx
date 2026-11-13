import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLUS ULTRA MATH HEROES — Misi Ukuran Pahlawan",
  description: "Laman pembelajaran interaktif Matematik Tahun 5: panjang dan penukaran unit.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ms">
      <head>
        <meta name="referrer" content="no-referrer" />
        <meta name="theme-color" content="#031426" />
        <meta name="guru-deku-api" content="/api/guru-deku" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/academy.css" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
