"use client";

import { Award, Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/features/auth/AuthProvider";
import { useUiConfig } from "@/features/ui-config/store";
import { apiBlob } from "@/lib/api";
import type { Badge } from "@/lib/types";

/** Tautan resmi LinkedIn "Add licence or certification" (prefill). */
export function linkedInCertUrl(badge: { name: string; awarded_at: string | null }, organization: string): string {
  const date = badge.awarded_at ? new Date(badge.awarded_at) : new Date();
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: badge.name,
    organizationName: organization,
    issueYear: String(date.getFullYear()),
    issueMonth: String(date.getMonth() + 1),
  });
  return `https://www.linkedin.com/profile/add?${params}`;
}

/** Bagikan badge sebagai sertifikat (PNG) dan tambahkan ke profil LinkedIn. */
export function BadgeShare({ badge, onClose }: { badge: Badge; onClose: () => void }) {
  const { user } = useAuth();
  const appName = useUiConfig().branding.app_name;
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    apiBlob(`/me/badges/${badge.id}/card.png`)
      .then((b) => {
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch(() => setMessage("Kartu badge belum bisa dibuat."));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [badge.id]);

  const fileName = `badge-${badge.code}.png`;
  const text = `Saya meraih badge “${badge.name}” di ${appName}: ${badge.description}`;

  async function share() {
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(text).catch(() => undefined);
      setMessage("Teks disalin. Unduh gambarnya untuk dilampirkan.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 sm:place-items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-share-title"
        className="animate-pop-in card w-full max-w-xl rounded-b-none p-4 sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="badge-share-title" className="flex items-center gap-2 text-lg font-bold">
            <Award className="size-5 text-primary" aria-hidden /> {badge.name}
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 place-items-center rounded-full bg-surface-muted">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-3 aspect-[1200/628] overflow-hidden rounded-lg border border-border bg-surface-muted">
          {url && <img src={url} alt={`Sertifikat badge ${badge.name} untuk ${user?.name ?? ""}`} className="size-full object-cover" />}
        </div>
        {message && <p className="mt-2 text-sm text-muted" role="status">{message}</p>}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <a
            href={linkedInCertUrl(badge, appName)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0a66c2] text-sm font-semibold text-white hover:brightness-110"
          >
            <span className="grid size-5 place-items-center rounded-sm bg-white text-xs font-bold text-[#0a66c2]" aria-hidden>
              in
            </span>
            Tambah ke LinkedIn
          </a>
          <button type="button" onClick={share} disabled={!blob} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-surface-muted text-sm font-semibold disabled:opacity-50">
            <Share2 className="size-4" aria-hidden /> Bagikan
          </button>
          <a
            href={url ?? undefined}
            download={fileName}
            aria-disabled={!url}
            className={`flex h-11 items-center justify-center gap-2 rounded-lg bg-surface-muted text-sm font-semibold ${url ? "" : "pointer-events-none opacity-50"}`}
          >
            <Download className="size-4" aria-hidden /> Unduh PNG
          </a>
        </div>
      </div>
    </div>
  );
}
