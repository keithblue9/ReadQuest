"use client";

import { useUiConfig } from "@/features/ui-config/store";

const steps = [
  { icon: "⬆️", text: "Ketuk tombol Bagikan di bilah bawah Safari." },
  { icon: "➕", text: "Gulir lalu pilih “Tambah ke Layar Utama” (Add to Home Screen)." },
  { icon: "✅", text: "Ketuk “Tambah”, lalu buka aplikasi dari ikon di Layar Utama." },
];

export function IOSInstallGuide({ compact = false }: { compact?: boolean }) {
  const appName = useUiConfig().branding.app_name;
  return (
    <div>
      {!compact && (
        <>
          <h2 className="text-2xl font-bold">Pasang di iPhone 📲</h2>
          <p className="mt-2 text-muted">
            Agar pengingat baca dan notifikasi bisa muncul, pasang {appName} ke Layar Utama.
          </p>
        </>
      )}
      <ol className={`${compact ? "" : "mt-6"} flex flex-col gap-3`}>
        {steps.map((step, index) => (
          <li
            key={step.text}
            className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-muted text-lg">
              {step.icon}
            </span>
            <p className="pt-1.5">
              <span className="font-bold">{index + 1}. </span>
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
