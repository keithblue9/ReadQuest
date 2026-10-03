"use client";

import { useEffect, useState } from "react";

import { Avatar } from "@/components/PostCard";
import { Alert, Button } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Buddies, UserMini } from "@/lib/types";

export default function BuddyPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Buddies | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserMini[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Buddies>("/buddies").then(setData).catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<UserMini[]>(`/users?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((users) => setResults(users.filter((u) => u.id !== user?.id)))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, user?.id]);

  async function run(action: () => Promise<Buddies | void>, success?: string) {
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (result) setData(result);
      if (success) setMessage(success);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const buddy = data?.buddy;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <h1 className="text-2xl font-bold">Reading Buddy 🤝</h1>
        <p className="mt-1 text-muted">Berpasangan dengan satu rekan untuk saling menyemangati membaca.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      {message && (
        <p className="animate-pop-in rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success" role="status">
          {message}
        </p>
      )}

      {buddy ? (
        <section className="animate-pop-in rounded-3xl bg-primary p-5 text-primary-foreground shadow-xl shadow-primary/25">
          <div className="flex items-center gap-3">
            <Avatar name={buddy.user.name} url={buddy.user.avatar_url} />
            <div className="min-w-0">
              <p className="text-sm font-semibold opacity-80">Buddy-mu</p>
              <p className="truncate text-xl font-bold">{buddy.user.name}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-2xl" aria-hidden>
                {buddy.read_today ? "✅" : "⏳"}
              </p>
              <p className="text-xs font-semibold">{buddy.read_today ? "Sudah baca hari ini" : "Belum baca hari ini"}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-2xl font-bold">{buddy.streak}🔥</p>
              <p className="text-xs font-semibold">Streak</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => run(() => api(`/buddies/${buddy.pair_id}/cheer`, { method: "POST" }), "Semangat terkirim! 📣")}
            className="mt-4 h-12 w-full rounded-2xl bg-white font-bold text-[#6c4df6] transition active:scale-[0.98]"
          >
            📣 Semangati {buddy.user.name.split(" ")[0]}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Akhiri pasangan Reading Buddy?"))
                run(() => api<Buddies>(`/buddies/${buddy.pair_id}`, { method: "DELETE" }));
            }}
            className="mt-2 w-full text-sm font-semibold opacity-80"
          >
            Akhiri buddy
          </button>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">Cari rekan</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length < 2) setResults([]);
              }}
              placeholder="Cari rekan untuk diajak…"
              className="h-12 w-full rounded-2xl border border-border bg-surface px-4 outline-none focus:border-primary"
            />
          </label>
          <ul className="flex flex-col gap-2">
            {results.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <Avatar name={u.name} url={u.avatar_url} />
                <span className="flex-1 truncate font-semibold">{u.name}</span>
                <Button
                  className="h-9 w-auto px-4 text-sm"
                  onClick={() =>
                    run(
                      () => api<Buddies>(`/buddies?user_id=${u.id}`, { method: "POST" }),
                      `Ajakan terkirim ke ${u.name}`,
                    )
                  }
                >
                  Ajak
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!data?.incoming.length && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">Ajakan masuk</h2>
          {data.incoming.map((r) => (
            <div key={r.pair_id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <Avatar name={r.user.name} url={r.user.avatar_url} />
              <span className="flex-1 truncate font-semibold">{r.user.name}</span>
              <Button
                className="h-9 w-auto px-4 text-sm"
                onClick={() => run(() => api<Buddies>(`/buddies/${r.pair_id}/accept`, { method: "POST" }), "Kalian kini Reading Buddy! 🎉")}
              >
                Terima
              </Button>
              <button
                type="button"
                onClick={() => run(() => api<Buddies>(`/buddies/${r.pair_id}`, { method: "DELETE" }))}
                className="text-sm font-semibold text-muted"
              >
                Tolak
              </button>
            </div>
          ))}
        </section>
      )}

      {!!data?.outgoing.length && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">Menunggu jawaban</h2>
          {data.outgoing.map((r) => (
            <div key={r.pair_id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
              <Avatar name={r.user.name} url={r.user.avatar_url} />
              <span className="flex-1 truncate font-semibold">{r.user.name}</span>
              <button
                type="button"
                onClick={() => run(() => api<Buddies>(`/buddies/${r.pair_id}`, { method: "DELETE" }))}
                className="text-sm font-semibold text-muted"
              >
                Batalkan
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
