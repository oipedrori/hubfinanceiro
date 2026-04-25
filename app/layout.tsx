import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "800"],
  variable: "--font-noto",
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
    icon: "/icon.png",
    apple: "/icon.png",
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
    <html lang="en" className={noto.variable}>
      <body>{children}</body>
    </html>
  );
}
