import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { AuthProvider } from "@/features/auth/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaManager } from "@/features/pwa/PwaManager";
import { BrandingEffects } from "@/features/ui-config/BrandingEffects";

import "./globals.css";

// Font dihosting sendiri (OFL, lihat src/fonts/OFL.txt): tanpa request ke pihak ketiga, CSP tetap.
const jakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-jakarta",
  display: "swap",
});
const literata = localFont({
  src: "../fonts/literata-latin-wght-normal.woff2",
  weight: "200 900",
  variable: "--font-literata",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
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
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#121830" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`h-full antialiased ${jakarta.variable} ${literata.variable}`} suppressHydrationWarning>
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
