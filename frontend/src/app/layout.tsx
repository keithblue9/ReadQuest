import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { AuthProvider } from "@/features/auth/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaManager } from "@/features/pwa/PwaManager";
import { BrandingEffects } from "@/features/ui-config/BrandingEffects";

import "./globals.css";

// Nunito (SIL OFL, lihat fonts/OFL.txt) dibundel lokal: build tidak bergantung pada Google Fonts.
const nunito = localFont({
  src: "./fonts/Nunito-latin.woff2",
  variable: "--font-nunito",
  weight: "200 1000",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "ReadQuest", template: "%s · ReadQuest" },
  description: "Komunitas baca buku bergamifikasi — baca 15 menit sehari, kumpulkan poin.",
  applicationName: "ReadQuest",
  appleWebApp: { capable: true, title: "ReadQuest", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8f0" },
    { media: "(prefers-color-scheme: dark)", color: "#14111f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${nunito.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full font-sans">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <PwaManager />
          <BrandingEffects />
        </ThemeProvider>
      </body>
    </html>
  );
}
