"use client";

import { Suspense, useEffect, useState } from "react";

import { Skeleton } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { FeedView } from "@/features/feed/FeedView";
import { Composer } from "@/features/home/Composer";
import { HomeExtras } from "@/features/home/HomeExtras";
import { TeamStrip, TodayHero } from "@/features/home/TodayHero";
import { refreshShellData } from "@/features/shell/useShellData";
import { useFeature, useT } from "@/features/ui-config/store";
import type { Post } from "@/lib/types";

/**
 * Beranda. Urutan mengikuti "apa yang harus terlihat dalam 3 detik":
 * sisa menit + lanjut baca → rekan yang sudah membaca → pendamping (quest, buddy, room) → feed.
 */
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
      <TodayHero />
      <TeamStrip />
      <div className="grid gap-3 sm:grid-cols-2 xl:hidden [&>*]:h-fit">
        <HomeExtras />
      </div>
      <h2 className="mt-4 px-1 font-display text-xl font-semibold">Catatan tim</h2>
      <Composer onPosted={setPosted} />
      {feedOn ? (
        <Suspense fallback={<FeedSkeleton />}>
          <FeedView basePath="/" prepend={posted} />
        </Suspense>
      ) : (
        <p className="card p-6 text-center text-sm text-muted">{t("common.feature_off_body")}</p>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-11/12" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
