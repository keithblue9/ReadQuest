"use client";

import { useState } from "react";

import { Alert } from "@/components/ui";
import { type Feature, type Menu, type UiConfig, useT } from "@/features/ui-config/store";
import { errorMessage } from "@/lib/errors";

import { Card, SaveBar, saveSection, Toggle } from "./shared";

const FEATURE_INFO: Record<Feature, { label: string; icon: string; description: string }> = {
  feed: { label: "Feed sosial", icon: "💬", description: "Catatan, reaksi, dan komentar tim di Beranda." },
  books: { label: "Katalog buku", icon: "📚", description: "Daftar buku & menambah buku baru." },
  leaderboard: { label: "Peringkat", icon: "🏆", description: "Leaderboard poin, menit, dan streak." },
  quests: { label: "Quest", icon: "🎯", description: "Tantangan mingguan." },
  buddy: { label: "Reading Buddy", icon: "🤝", description: "Berpasangan & saling menyemangati." },
  room: { label: "Reading Room", icon: "🛋️", description: "Baca bersama secara live." },
  book_of_month: { label: "Book of the Month", icon: "📌", description: "Sorotan buku bulan ini di beranda." },
  push: { label: "Notifikasi push", icon: "🔔", description: "Push ke HP/desktop. Notifikasi di aplikasi tetap ada." },
};

const MENU_FEATURE: Partial<Record<Menu, Feature>> = {
  books: "books",
  leaderboard: "leaderboard",
  quests: "quests",
  buddy: "buddy",
  room: "room",
};

type Draft = UiConfig["features"];

export function FeaturesCard({ config, onSaved }: { config: UiConfig; onSaved: (c: UiConfig) => void }) {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(config.features);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(config.features);

  const update = (fn: (d: Draft) => Draft) => {
    setMessage(null);
    setDraft(fn);
  };
  const moveMenu = (from: number, to: number) =>
    update((d) => {
      const order = [...d.menu_order];
      const [item] = order.splice(from, 1);
      order.splice(to, 0, item);
      return { ...d, menu_order: order };
    });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = await saveSection("features", draft);
      setDraft(next.features);
      onSaved(next);
      setMessage("Tersimpan ✓");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Fitur & menu"
      description="Matikan fitur yang belum dipakai tim: menunya disembunyikan dan halamannya tidak bisa dibuka. Data tidak dihapus."
    >
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {(Object.keys(FEATURE_INFO) as Feature[]).map((feature) => {
            const info = FEATURE_INFO[feature];
            return (
              <li key={feature} className="flex items-center gap-3 px-4 py-3">
                <span className="text-2xl" aria-hidden>
                  {info.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{info.label}</p>
                  <p className="text-xs text-muted">{info.description}</p>
                </div>
                <Toggle
                  checked={draft.enabled[feature]}
                  label={info.label}
                  onChange={(v) => update((d) => ({ ...d, enabled: { ...d.enabled, [feature]: v } }))}
                />
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">Urutan menu</p>
          <ol className="flex flex-col gap-1.5">
            {draft.menu_order.map((menu, i) => {
              const feature = MENU_FEATURE[menu];
              const off = feature ? !draft.enabled[feature] : false;
              return (
                <li
                  key={menu}
                  className={`flex items-center gap-2 rounded-xl border border-border px-3 py-2 ${off ? "opacity-50" : ""}`}
                >
                  <span className="w-5 text-right text-xs font-bold text-muted tabular-nums">{i + 1}</span>
                  <span className="flex-1 font-semibold">
                    {t(`nav.${menu}`)}
                    {off && <span className="ml-2 text-xs font-bold text-muted">(dimatikan)</span>}
                  </span>
                  <button
                    type="button"
                    aria-label={`Naikkan ${t(`nav.${menu}`)}`}
                    disabled={i === 0}
                    onClick={() => moveMenu(i, i - 1)}
                    className="grid size-8 place-items-center rounded-lg hover:bg-surface-muted disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Turunkan ${t(`nav.${menu}`)}`}
                    disabled={i === draft.menu_order.length - 1}
                    onClick={() => moveMenu(i, i + 1)}
                    className="grid size-8 place-items-center rounded-lg hover:bg-surface-muted disabled:opacity-30"
                  >
                    ↓
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-muted">Nama menu bisa diganti di tab Teks (grup “Menu navigasi”).</p>
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setDraft(config.features)} message={message} />
    </Card>
  );
}
