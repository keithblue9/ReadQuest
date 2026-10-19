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
              <span className={`grid size-12 place-items-center rounded-full text-2xl ${b.earned ? "bg-highlight/50" : "bg-surface-muted opacity-60 grayscale"}`} aria-hidden>
                {b.icon}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="line-clamp-2 block text-sm leading-snug font-semibold">{b.name}</span>
                <span className="block text-xs text-muted">
                  {b.earned ? (shareable ? "Bagikan →" : "Didapat") : `${Math.min(b.progress, b.target)}/${b.target}`}
                </span>
                {!b.earned && (
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-[2px] bg-line">
                    <span className="block h-full border-r-2 border-ink bg-highlight dark:border-r-0" style={{ width: `${Math.min(100, (b.progress / Math.max(1, b.target)) * 100)}%` }} />
                  </span>
                )}
              </span>
              {!b.earned && <Lock className="size-4 shrink-0 text-muted" aria-hidden />}
            </>
          );
          const cls = `flex min-h-16 w-full items-center gap-3 rounded-xl border p-2.5 ${b.earned ? "border-line bg-surface" : "border-dashed border-line bg-paper/60"}`;
          return (
            <li key={b.id} title={b.description}>
              {b.earned && shareable ? (
                <button type="button" onClick={() => setSharing(b)} className={`${cls} transition hover:border-ink`}>
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
