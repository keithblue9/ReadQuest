"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { UserMini } from "@/lib/types";

type Props = {
  value: string;
  onChange: (value: string) => void;
  mentions: UserMini[];
  onMentionsChange: (mentions: UserMini[]) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  label: string;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
};

const TRIGGER = /(?:^|\s)@([\p{L}\p{N} ]{1,24})$/u;

/** Textarea dengan autocomplete @mention. Hanya mention yang masih ada di teks yang dikirim. */
export function MentionTextarea({
  value,
  onChange,
  mentions,
  onMentionsChange,
  placeholder,
  rows = 3,
  id,
  label,
  onPaste,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<UserMini[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<UserMini[]>(`/users?q=${encodeURIComponent(query)}&limit=6`, {
        signal: controller.signal,
      })
        .then((users) => {
          setSuggestions(users);
          setActive(0);
        })
        .catch(() => undefined);
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Pulihkan posisi kursor tepat setelah DOM diperbarui (sebelum ketikan berikutnya).
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !ref.current) return;
    ref.current.focus();
    ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  function handleChange(text: string, caret: number) {
    onChange(text);
    const match = text.slice(0, caret).match(TRIGGER);
    const q = match ? match[1].trimStart() : null;
    setQuery(q || null);
    if (!q) setSuggestions([]);
    // Lupakan mention yang namanya sudah dihapus dari teks.
    const kept = mentions.filter((m) => text.includes(`@${m.name}`));
    if (kept.length !== mentions.length) onMentionsChange(kept);
  }

  function pick(user: UserMini) {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(TRIGGER, (m) => m.replace(/@.*$/u, `@${user.name} `));
    const next = before + value.slice(caret);
    onChange(next);
    if (!mentions.some((m) => m.id === user.id)) onMentionsChange([...mentions, user]);
    setQuery(null);
    setSuggestions([]);
    pendingCaret.current = before.length;
  }

  const open = query !== null && suggestions.length > 0;

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onPaste={onPaste}
        onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(suggestions[active]);
          } else if (e.key === "Escape") {
            setQuery(null);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-mentions` : undefined}
        aria-autocomplete="list"
        className="w-full rounded-2xl border border-border bg-surface p-3 leading-relaxed outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
      />
      {open && (
        <ul
          id={id ? `${id}-mentions` : undefined}
          role="listbox"
          className="absolute inset-x-0 bottom-full z-30 mb-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
        >
          {suggestions.map((user, i) => (
            <li key={user.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(user);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left font-semibold ${
                  i === active ? "bg-primary/10 text-primary" : ""
                }`}
              >
                <span className="grid size-7 place-items-center rounded-full bg-accent/20 text-xs font-extrabold text-accent">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                {user.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
