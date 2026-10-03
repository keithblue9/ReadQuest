"use client";

import { type UiConfig, useUiConfig } from "@/features/ui-config/store";
import { splitBrandName } from "@/lib/texts";

type Props = {
  /** Tampilkan slogan di bawah nama aplikasi. */
  tagline?: boolean;
  size?: "md" | "lg";
  /** Pratinjau di Admin: pakai nilai draf, bukan konfigurasi tersimpan. */
  preview?: Pick<UiConfig["branding"], "app_name" | "tagline" | "logo_emoji" | "logo_url">;
};

/** Logo aplikasi: ikon (emoji atau gambar) + nama dua warna + slogan, semuanya diatur Admin. */
export function Logo({ tagline = false, size = "md", preview }: Props) {
  const saved = useUiConfig().branding;
  const branding = preview ?? saved;
  const [first, second] = splitBrandName(branding.app_name);
  const box = size === "lg" ? "size-12 text-2xl" : "size-10 text-xl";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 ${box}`}
      >
        {branding.logo_url ? (
          <img src={branding.logo_url} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden>{branding.logo_emoji}</span>
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className={`truncate font-extrabold tracking-tight ${size === "lg" ? "text-2xl" : "text-xl"} leading-tight`}
        >
          {first}
          {second && <span className="text-accent">{second}</span>}
        </span>
        {tagline && branding.tagline && (
          <span className="truncate text-xs font-semibold text-muted">{branding.tagline}</span>
        )}
      </span>
    </div>
  );
}
