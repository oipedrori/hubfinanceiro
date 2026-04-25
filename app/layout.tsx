import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const googleSansEquivalent = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Hub Financeiro Bot",
  description: "Gerencie suas finanças com o poder da voz e Inteligência Artificial.",
  manifest: "/manifest.json",
  appleWebApp: {
     capable: true,
     title: "Hub Bot",
     statusBarStyle: "black-translucent"
  },
  icons: {
    icon: [
      { url: "/icons/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icons/favicon-light.png", media: "(prefers-color-scheme: light)" },
    ],
    apple: [
      { url: "/icons/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icons/favicon-light.png", media: "(prefers-color-scheme: light)" },
    ]
  }
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={googleSansEquivalent.variable}>
      <body>{children}</body>
    </html>
  );
}
