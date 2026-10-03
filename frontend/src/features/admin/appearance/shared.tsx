"use client";

import { normalizeUiConfig, setUiConfig, type UiConfig } from "@/features/ui-config/store";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/image";

export type Section = "branding" | "login" | "features" | "texts";

/** Simpan satu bagian tampilan; seluruh aplikasi langsung memakai nilai baru. */
export async function saveSection(section: Section, value: unknown): Promise<UiConfig> {
  const config = await api<UiConfig>(`/admin/ui/${section}`, { method: "PUT", json: { value } });
  setUiConfig(config);
  return normalizeUiConfig(config);
}

export type UploadedImage = { key: string; url: string; width: number; height: number };

const LOGO_RAW_LIMIT = 2 * 1024 * 1024;

/**
 * Background dikompres di perangkat (maks 2400 px, ±2,5 MB) agar unggahan cepat. Logo kecil
 * dikirim apa adanya supaya transparansi PNG tetap terjaga; server tetap memproses ulang.
 */
export async function uploadUiImage(file: File, kind: "background" | "logo"): Promise<UploadedImage> {
  const blob =
    kind === "background"
      ? await compressImage(file, { maxDimension: 2400, targetBytes: 2.5 * 1024 * 1024 })
      : file.size <= LOGO_RAW_LIMIT
        ? file
        : await compressImage(file, { maxDimension: 1024 });
  const form = new FormData();
  form.append("file", blob, blob === file ? file.name : "image.jpg");
  return api<UploadedImage>(`/admin/ui/images?kind=${kind}`, { method: "POST", body: form });
}

export const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";

export function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-4 md:p-6">
      <header>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </header>
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-primary" : "bg-border"}`}
    >
      <span
        className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
  message,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  message: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
      >
        {saving ? "Menyimpan…" : "Simpan"}
      </button>
      {dirty && !saving && (
        <button type="button" onClick={onReset} className="text-sm font-bold text-muted hover:text-foreground">
          Batalkan perubahan
        </button>
      )}
      {message && (
        <span role="status" className="text-sm font-semibold text-success">
          {message}
        </span>
      )}
    </div>
  );
}
