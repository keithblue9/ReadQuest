"use client";

import { useEffect } from "react";

import { useUiConfig } from "./store";

const DEFAULT_NAME = "ReadQuest";

/**
 * Metadata judul tab dibuat statis saat build ("… · ReadQuest"); komponen ini mengganti nama
 * bawaan dengan nama aplikasi dari Admin, termasuk setiap kali Next.js memperbarui <title>.
 */
export function BrandingEffects() {
  const { app_name } = useUiConfig().branding;

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
