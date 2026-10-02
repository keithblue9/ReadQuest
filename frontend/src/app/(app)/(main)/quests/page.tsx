"use client";

import { useEffect, useState } from "react";

import { QuestCard } from "@/features/quests/QuestCard";
import { api } from "@/lib/api";
import type { Quest } from "@/lib/types";

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[] | null>(null);
  useEffect(() => {
    api<Quest[]>("/quests").then(setQuests).catch(() => setQuests([]));
  }, []);
  const ends = quests?.[0]?.ends_at ? new Date(quests[0].ends_at) : null;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-2xl font-extrabold">Quest Mingguan 🎯</h1>
        <p className="mt-1 text-muted">
          Selesaikan tantangan untuk poin bonus.
          {ends &&
            ` Berakhir ${ends.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })}.`}
        </p>
      </div>
      {quests === null ? (
        <p className="text-sm text-muted">Memuat quest…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {quests.map((q) => (
            <QuestCard key={q.id} quest={q} />
          ))}
        </ul>
      )}
    </div>
  );
}
