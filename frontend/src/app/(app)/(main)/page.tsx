"use client";

import { Suspense, useEffect, useState } from "react";

import { useAuth } from "@/features/auth/AuthProvider";
import { FeedView } from "@/features/feed/FeedView";
import { Composer } from "@/features/home/Composer";
import { HomeExtras } from "@/features/home/HomeExtras";
import { refreshShellData } from "@/features/shell/useShellData";
import { TargetCard, TeamTodayCard } from "@/features/shell/widgets";
import { useFeature, useT } from "@/features/ui-config/store";
import type { Post } from "@/lib/types";

/** Beranda: composer + ringkasan (HP) + feed tim. Di desktop ringkasan ada di panel kanan. */
export default function HomePage() {
  const t = useT();
  const { refreshUser } = useAuth();
  const feedOn = useFeature("feed");
  const [posted, setPosted] = useState<Post | null>(null);

  useEffect(() => {
    refreshUser();
    refreshShellData(true);
  }, [refreshUser]);

  return (
    <div className="flex flex-col gap-3">
      <Composer onPosted={setPosted} />
      <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
        <TargetCard />
        <TeamTodayCard />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:hidden [&>*]:h-fit">
        <HomeExtras />
      </div>
      {feedOn ? (
        <Suspense fallback={null}>
          <FeedView basePath="/" prepend={posted} />
        </Suspense>
      ) : (
        <p className="card p-6 text-center text-sm text-muted">{t("common.feature_off_body")}</p>
      )}
    </div>
  );
}
