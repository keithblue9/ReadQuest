"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { FullScreenSpinner } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

export default function AppLayout({ children }: LayoutProps<"/">) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const needsOnboarding = status === "authenticated" && !user?.onboarding_completed;
  const onOnboarding = pathname === "/onboarding";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    else if (needsOnboarding && !onOnboarding) router.replace("/onboarding");
  }, [status, needsOnboarding, onOnboarding, router]);

  if (status !== "authenticated" || (needsOnboarding && !onOnboarding)) {
    return <FullScreenSpinner />;
  }
  return <>{children}</>;
}
