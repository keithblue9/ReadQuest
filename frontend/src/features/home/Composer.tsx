"use client";

import { Quote, Timer, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/features/auth/AuthProvider";
import { QuoteComposer } from "@/features/feed/QuoteComposer";
import { useT } from "@/features/ui-config/store";
import type { Post } from "@/lib/types";

/** Kotak "Apa yang kamu baca hari ini?" ala media sosial: sesi baca, sesi kilat, kutipan. */
export function Composer({ onPosted }: { onPosted: (post: Post) => void }) {
  const t = useT();
  const { user } = useAuth();
  const [quoting, setQuoting] = useState(false);
  if (!user) return null;
  const firstName = user.name.split(" ")[0];
  const action = "flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-muted hover:bg-surface-muted";

  return (
    <section className="card p-3" aria-label="Buat posting">
      <div className="flex items-center gap-2">
        <Avatar name={user.name} url={user.avatar_url} />
        <Link
          href="/read"
          className="flex h-10 flex-1 items-center rounded-full bg-surface-muted px-4 text-[15px] text-muted transition hover:brightness-95"
        >
          {t("home.composer_prompt", { name: firstName })}
        </Link>
      </div>
      <div className="mt-2 flex border-t border-border pt-2">
        <Link href="/read" className={action}>
          <Timer className="size-5 text-primary" aria-hidden />
          <span>{t("home.composer_read")}</span>
        </Link>
        <Link href="/read?mode=micro" className={action}>
          <Zap className="size-5 text-amber-500" aria-hidden />
          <span>{t("home.composer_micro")}</span>
        </Link>
        <button type="button" onClick={() => setQuoting(true)} className={action}>
          <Quote className="size-5 text-teal-600" aria-hidden />
          <span>{t("home.composer_quote")}</span>
        </button>
      </div>
      {quoting && (
        <QuoteComposer
          onClose={() => setQuoting(false)}
          onCreated={(post) => {
            setQuoting(false);
            onPosted(post);
          }}
        />
      )}
    </section>
  );
}
