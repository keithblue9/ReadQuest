"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { FullScreenSpinner, Logo } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  if (status !== "unauthenticated") return <FullScreenSpinner />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>
      <div className="flex flex-1 flex-col justify-center py-8">{children}</div>
    </main>
  );
}
