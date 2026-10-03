"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { type Feature, useT, useUiConfig } from "./store";

/** Halaman → fitur yang harus aktif. Fitur yang dimatikan Admin tidak bisa dibuka lewat URL. */
const ROUTE_FEATURES: [prefix: string, feature: Feature][] = [
  ["/feed", "feed"],
  ["/posts", "feed"],
  ["/books", "books"],
  ["/leaderboard", "leaderboard"],
  ["/quests", "quests"],
  ["/buddy", "buddy"],
  ["/room", "room"],
];

export function featureForPath(pathname: string): Feature | null {
  const hit = ROUTE_FEATURES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? hit[1] : null;
}

export function FeatureGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { enabled } = useUiConfig().features;
  const t = useT();
  const feature = featureForPath(pathname);

  if (feature && !enabled[feature]) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-dashed border-border p-8 text-center">
        <p className="text-4xl" aria-hidden>
          🚧
        </p>
        <h1 className="mt-2 text-lg font-bold">{t("common.feature_off_title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("common.feature_off_body")}</p>
        <Link href="/" className="mt-4 inline-block font-bold text-primary">
          {t("common.back_home")}
        </Link>
      </div>
    );
  }
  return children;
}
