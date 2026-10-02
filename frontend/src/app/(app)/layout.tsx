"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { OfflineBanner, OfflineScreen } from "@/components/OfflineScreen";
import { FullScreenSpinner } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOnline } from "@/hooks/useOnline";

export default function AppLayout({ children }: LayoutProps<"/">) {
  const { status, user, retry } = useAuth();
  const online = useOnline();
  const router = useRouter();
  const pathname = usePathname();

  const needsOnboarding = status === "authenticated" && !user?.onboarding_completed;
  const onOnboarding = pathname === "/onboarding";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    else if (needsOnboarding && !onOnboarding) router.replace("/onboarding");
  }, [status, needsOnboarding, onOnboarding, router]);

  if (status === "offline") return <OfflineScreen onRetry={retry} />;
  if (status !== "authenticated" || (needsOnboarding && !onOnboarding)) {
    return <FullScreenSpinner />;
  }
  return (
    <>
      {!online && <OfflineBanner />}
      {children}
    </>
  );
}
