import Link from "next/link";
import { Fragment } from "react";

import type { UserMini } from "@/lib/types";

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Teks catatan dengan @mention dan #topik yang bisa diklik. */
export function RichText({ text, mentions = [] }: { text: string; mentions?: UserMini[] }) {
  const names = [...mentions].sort((a, b) => b.name.length - a.name.length);
  const parts = [
    ...names.map((m) => `@${escapeRegExp(m.name)}`),
    "#[\\p{L}\\p{N}_-]{2,30}",
  ];
  const pattern = new RegExp(`(${parts.join("|")})`, "gu");
  const tokens = text.split(pattern);

  return (
    <>
      {tokens.map((token, i) => {
        if (!token) return null;
        if (token.startsWith("@") && names.some((m) => `@${m.name}` === token)) {
          return (
            <span key={i} className="rounded bg-primary/10 px-0.5 font-semibold text-primary">
              {token}
            </span>
          );
        }
        if (/^#[\p{L}\p{N}_-]{2,30}$/u.test(token)) {
          return (
            <Link
              key={i}
              href={`/feed?topic=${encodeURIComponent(token.slice(1).toLowerCase())}`}
              className="font-semibold text-primary"
            >
              {token}
            </Link>
          );
        }
        return <Fragment key={i}>{token}</Fragment>;
      })}
    </>
  );
}
