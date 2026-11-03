"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Alert, INPUT_CLASS, Skeleton } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { useT } from "@/features/ui-config/store";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

type Member = { id: string; name: string; function: string | null; avatar_url: string | null };

/** Mode masuk tanpa PIN: cari lalu ketuk nama → langsung masuk. */
export function MemberPicker() {
  const { enter } = useAuth();
  const t = useT();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Member[]>("/auth/members", { auth: false })
      .then(setMembers)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("id-ID");
    if (!members || !q) return members;
    return members.filter(
      (m) => m.name.toLocaleLowerCase("id-ID").includes(q) || m.function?.toLocaleLowerCase("id-ID").includes(q),
    );
  }, [members, query]);

  async function pick(member: Member) {
    setPendingId(member.id);
    setError(null);
    try {
      await enter(member.id);
    } catch (err) {
      setError(errorMessage(err));
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert>{error}</Alert>}
      <label className="relative block">
        <span className="sr-only">{t("auth.pick.search")}</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("auth.pick.search")}
          autoComplete="off"
          className={`${INPUT_CLASS} border-line pl-11`}
        />
      </label>

      {shown === null ? (
        <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Memuat daftar nama">
          {[0, 1, 2, 3].map((i) => (
            <li key={i}>
              <Skeleton className="h-16 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          {t("auth.pick.empty")}
        </p>
      ) : (
        <ul className="flex max-h-[52dvh] flex-col gap-2 overflow-y-auto pr-1" aria-label="Daftar anggota">
          {shown.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => pick(m)}
                disabled={pendingId !== null}
                aria-busy={pendingId === m.id || undefined}
                className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:border-ink hover:bg-surface-muted disabled:opacity-60"
              >
                <Avatar name={m.name} url={m.avatar_url} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.name}</span>
                  {m.function && <span className="block truncate text-sm text-muted">{m.function}</span>}
                </span>
                {pendingId === m.id && (
                  <span className="size-4 animate-spin rounded-full border-2 border-ink border-t-transparent" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
