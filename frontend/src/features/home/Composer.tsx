"use client";

import { Quote } from "lucide-react";
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
  return (
    <section className="card flex items-center gap-3 p-3" aria-label="Bagikan kutipan">
      <Avatar name={user.name} url={user.avatar_url} />
      <button
        type="button"
        onClick={() => setQuoting(true)}
        className="flex h-11 min-w-0 flex-1 items-center rounded-xl bg-surface-muted px-4 text-left text-[15px] text-muted transition hover:text-ink"
      >
        <span className="truncate">{t("home.composer_prompt", { name: firstName })}</span>
      </button>
      <button
        type="button"
        onClick={() => setQuoting(true)}
        aria-label={t("home.composer_quote")}
        className="flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink transition hover:bg-surface-muted"
      >
        <Quote className="size-5" aria-hidden />
        <span className="hidden sm:inline">{t("home.composer_quote")}</span>
      </button>
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
