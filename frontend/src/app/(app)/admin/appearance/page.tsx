"use client";

import { useEffect, useState } from "react";

import { Alert } from "@/components/ui";
import { BackgroundsCard } from "@/features/admin/appearance/BackgroundsCard";
import { BrandingCard } from "@/features/admin/appearance/BrandingCard";
import { FeaturesCard } from "@/features/admin/appearance/FeaturesCard";
import { TextsCard } from "@/features/admin/appearance/TextsCard";
import { normalizeUiConfig, setUiConfig, type UiConfig } from "@/features/ui-config/store";

const TABS = [
  { id: "branding", label: "🏷️ Branding" },
  { id: "login", label: "🖼️ Background login" },
  { id: "features", label: "🧩 Fitur & menu" },
  { id: "texts", label: "✍️ Teks" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function AdminAppearancePage() {
  const [config, setConfig] = useState<UiConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("branding");

  useEffect(() => {
    // Selalu ambil versi terbaru (bukan cache) agar Admin mengedit data yang sebenarnya.
    fetch("/api/v1/ui-config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Gagal memuat pengaturan tampilan"))))
      .then((data) => {
        setUiConfig(data);
        setConfig(normalizeUiConfig(data));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold">Tampilan & Teks</h1>
        <p className="text-sm text-muted">
          Atur nama aplikasi, slogan, ikon, background login, fitur yang aktif, dan semua teks. Perubahan langsung
          berlaku untuk semua anggota dan tercatat di audit log.
        </p>
      </header>

      <div role="tablist" aria-label="Bagian tampilan" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}
      {!config ? (
        !error && <p className="text-sm text-muted">Memuat…</p>
      ) : (
        <div role="tabpanel">
          {tab === "branding" && <BrandingCard config={config} onSaved={setConfig} />}
          {tab === "login" && <BackgroundsCard config={config} onSaved={setConfig} />}
          {tab === "features" && <FeaturesCard config={config} onSaved={setConfig} />}
          {tab === "texts" && <TextsCard config={config} onSaved={setConfig} />}
        </div>
      )}
    </section>
  );
}
