"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { OfflineScreen } from "@/components/OfflineScreen";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FullScreenSpinner, Logo } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { LoginBackdrop } from "@/features/ui-config/LoginBackdrop";
import { useT } from "@/features/ui-config/store";

/**
 * HP: satu kolom seperti biasa. Desktop (lg+): background slideshow memenuhi layar dan kotak
 * login berada di sisi kiri sehingga gambar tetap terlihat.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  const { status, retry } = useAuth();
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  if (status === "offline") return <OfflineScreen onRetry={retry} />;
  if (status !== "unauthenticated") return <FullScreenSpinner />;

  return (
    <div className="relative min-h-dvh">
      <div className="hidden lg:fixed lg:inset-0 lg:block">
        <LoginBackdrop />
      </div>
      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10 lg:m-6 lg:min-h-[calc(100dvh-3rem)] lg:w-[460px] lg:max-w-none lg:rounded-[2rem] lg:border lg:border-border lg:bg-background/95 lg:px-10 lg:pt-8 lg:pb-8 lg:shadow-2xl lg:backdrop-blur-md">
        <header className="flex items-center justify-between gap-3">
          <Logo tagline />
          <ThemeToggle />
        </header>
        <div className="flex flex-1 flex-col justify-center py-8">{children}</div>
        <footer className="hidden text-center text-xs text-muted lg:block">{t("auth.footer")}</footer>
      </main>
    </div>
  );
}
