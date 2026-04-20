import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hub Financeiro Bot",
  description: "Gerencie suas finanças com o poder da voz e Inteligência Artificial.",
  manifest: "/manifest.json",
  themeColor: "#3182ce",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  appleWebApp: {
     capable: true,
     title: "Hub Bot",
     statusBarStyle: "black-translucent"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
