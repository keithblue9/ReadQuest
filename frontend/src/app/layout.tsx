import type { Metadata, Viewport } from "next";

import { AuthProvider } from "@/features/auth/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaManager } from "@/features/pwa/PwaManager";
import { BrandingEffects } from "@/features/ui-config/BrandingEffects";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ReadQuest", template: "%s · ReadQuest" },
  description: "Komunitas baca buku bergamifikasi — baca 15 menit sehari, kumpulkan poin.",
  applicationName: "ReadQuest",
  appleWebApp: { capable: true, title: "ReadQuest", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f2f5" },
    { media: "(prefers-color-scheme: dark)", color: "#18191a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
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
