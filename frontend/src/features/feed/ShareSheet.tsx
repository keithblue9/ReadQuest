"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { apiBlob } from "@/lib/api";
import type { Post } from "@/lib/types";

function shareText(post: Post) {
  const excerpt = post.content.length > 180 ? `${post.content.slice(0, 177)}…` : post.content;
  return `“${excerpt}”\n\n— ${post.author.name} tentang “${post.book.title}” (${post.book.authors.join(", ")}) di ReadQuest 📚`;
}

export function ShareSheet({ post, onClose }: { post: Post; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const text = shareText(post);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function cardFile() {
    const blob = await apiBlob(`/posts/${post.id}/share-card.png`);
    return new File([blob], `readquest-${post.id}.png`, { type: "image/png" });
  }

  async function shareNative() {
    setBusy(true);
    setMessage(null);
    try {
      const file = await cardFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        download(file);
        setMessage("Perangkat ini belum mendukung berbagi file — kartu diunduh.");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setMessage("Gagal membagikan kartu.");
    } finally {
      setBusy(false);
    }
  }

  function download(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadCard() {
    setBusy(true);
    try {
      download(await cardFile());
    } finally {
      setBusy(false);
    }
  }

  const options = [
    {
      label: "WhatsApp",
      icon: "💬",
      href: `https://wa.me/?text=${encodeURIComponent(text)}`,
    },
    {
      label: "LinkedIn",
      icon: "💼",
      href: `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`,
    },
  ];

  // Portal ke <body>: kartu posting memakai animasi transform yang akan menjadi
  // containing block bagi elemen `position: fixed` di dalamnya.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`share-${post.id}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="animate-pop-in w-full max-w-md rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" aria-hidden />
        <h2 id={`share-${post.id}`} className="text-lg font-extrabold">
          Bagikan catatan
        </h2>
        <p className="mt-1 text-sm text-muted">Kartu berisi kutipan, judul buku, dan namamu.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={shareNative}
            disabled={busy}
            className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground disabled:opacity-60"
          >
            📤 Bagikan kartu
          </button>
          {options.map((o) => (
            <a
              key={o.label}
              href={o.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border font-bold"
            >
              <span aria-hidden>{o.icon}</span> {o.label}
            </a>
          ))}
          <button
            type="button"
            onClick={downloadCard}
            disabled={busy}
            className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-2xl border border-border font-bold disabled:opacity-60"
          >
            ⬇️ Unduh kartu
          </button>
        </div>
        {message && <p className="mt-3 text-center text-sm text-muted">{message}</p>}
      </div>
    </div>,
    document.body,
  );
}
