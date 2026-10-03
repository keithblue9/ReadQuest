"use client";

import { Lock } from "lucide-react";
import { useState } from "react";

import { BadgeShare } from "@/features/profile/BadgeShare";
import type { Badge } from "@/lib/types";

/** Grid badge; badge yang sudah didapat bisa dibagikan (sertifikat / LinkedIn) bila `shareable`. */
export function BadgeGrid({ badges, shareable = false }: { badges: Badge[]; shareable?: boolean }) {
  const [sharing, setSharing] = useState<Badge | null>(null);
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {badges.map((b) => {
          const body = (
            <>
              <span className={`grid size-12 place-items-center rounded-full text-2xl ${b.earned ? "bg-primary/10" : "bg-surface-muted grayscale"}`} aria-hidden>
                {b.icon}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold">{b.name}</span>
                <span className="block text-xs text-muted">
                  {b.earned ? (shareable ? "Bagikan →" : "Didapat") : `${Math.min(b.progress, b.target)}/${b.target}`}
                </span>
                {!b.earned && (
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-border">
                    <span className="block h-full bg-primary" style={{ width: `${Math.min(100, (b.progress / Math.max(1, b.target)) * 100)}%` }} />
                  </span>
                )}
              </span>
              {!b.earned && <Lock className="size-4 shrink-0 text-muted" aria-hidden />}
            </>
          );
          const cls = `flex w-full items-center gap-3 rounded-lg border p-2.5 ${b.earned ? "border-border bg-surface" : "border-dashed border-border opacity-70"}`;
          return (
            <li key={b.id} title={b.description}>
              {b.earned && shareable ? (
                <button type="button" onClick={() => setSharing(b)} className={`${cls} transition hover:border-primary`}>
                  {body}
                </button>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {sharing && <BadgeShare badge={sharing} onClose={() => setSharing(null)} />}
    </>
  );
}
