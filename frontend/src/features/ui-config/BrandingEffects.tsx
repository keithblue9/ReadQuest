"use client";

import { useEffect } from "react";

import { brandAccent } from "@/lib/color";

import { useUiConfig } from "./store";

const DEFAULT_NAME = "ReadQuest";
/** Nilai bawaan backend = "tanpa override" (pakai aksen sistem desain). */
const DEFAULT_COLOR = "#2563eb";

/**
 * Metadata judul tab dibuat statis saat build ("… · ReadQuest"); komponen ini mengganti nama
 * bawaan dengan nama aplikasi dari Admin, termasuk setiap kali Next.js memperbarui <title>.
 */
export function BrandingEffects() {
  const { app_name, primary_color } = useUiConfig().branding;

  // Warna merek dari Admin hanya mengisi aksen merek (tile logo, tautan), dikunci ≥4.5:1
  // terhadap permukaan terang & gelap. Tinta dan stabilo tetap milik sistem desain.
  useEffect(() => {
    const root = document.documentElement.style;
    if (!/^#[0-9a-f]{6}$/i.test(primary_color) || primary_color.toLowerCase() === DEFAULT_COLOR) {
      root.removeProperty("--brand-light");
      root.removeProperty("--brand-dark");
      return;
    }
    root.setProperty("--brand-light", brandAccent(primary_color, "#f6f7f9"));
    root.setProperty("--brand-dark", brandAccent(primary_color, "#1a2140"));
  }, [primary_color]);

  useEffect(() => {
    if (app_name === DEFAULT_NAME) return;
    const apply = () => {
      if (document.title.includes(DEFAULT_NAME)) {
        document.title = document.title.replaceAll(DEFAULT_NAME, app_name);
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [app_name]);

  return null;
}
