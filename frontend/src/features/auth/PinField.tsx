"use client";

import { useState, useSyncExternalStore } from "react";

import { Field } from "@/components/ui";
import { useT } from "@/features/ui-config/store";

type Props = {
  label?: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
};

const TOUCH_QUERY = "(pointer: coarse)";

function subscribeTouch(callback: () => void) {
  const media = window.matchMedia(TOUCH_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/**
 * Di layar sentuh, `<input type="password">` di sebagian browser (mis. Safari iOS) tetap
 * memunculkan keyboard huruf walau `inputMode="numeric"`. Karena itu di HP PIN memakai
 * `type="text"` + `inputMode="numeric"` (keypad angka) dan disamarkan dengan
 * `-webkit-text-security`. Browser tanpa dukungan CSS itu tetap memakai `type="password"`.
 */
function useNumericMaskedInput() {
  return useSyncExternalStore(
    subscribeTouch,
    () => window.matchMedia(TOUCH_QUERY).matches && CSS.supports("-webkit-text-security", "disc"),
    () => false,
  );
}

function digitsOnly(e: React.FormEvent<HTMLInputElement>, max?: number) {
  const digits = e.currentTarget.value.replace(/\D/g, "");
  e.currentTarget.value = max ? digits.slice(0, max) : digits;
}

/**
 * Input PIN 6 angka dengan keypad angka di HP dan tombol tampilkan/sembunyikan. Karakter selain
 * angka dibuang lalu dipotong ke 6 digit (tanpa `maxLength`, agar tempelan seperti "12-34 56"
 * tidak terpotong sebelum dibersihkan).
 */
export function PinField({ label, name = "pin", autoComplete, error, hint }: Props) {
  const t = useT();
  const masked = useNumericMaskedInput();
  const [visible, setVisible] = useState(false);
  const type = visible || masked ? "text" : "password";
  const security = masked && !visible ? "[-webkit-text-security:disc]" : "";

  return (
    <div className="relative">
      <Field
        label={label ?? t("auth.field.pin")}
        name={name}
        type={type}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={autoComplete}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        className={`pr-14 tracking-[0.5em] ${security}`}
        error={error}
        hint={hint}
        onInput={(e) => digitsOnly(e, 6)}
        required
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? t("auth.field.pin_hide") : t("auth.field.pin_show")}
        className="absolute top-7 right-1 grid size-11 place-items-center rounded-xl text-lg text-muted transition hover:text-foreground"
      >
        <span aria-hidden>{visible ? "🙈" : "👁️"}</span>
      </button>
    </div>
  );
}

/**
 * Input nomor HP: keypad angka murni (tanpa huruf/simbol). Spasi, tanda hubung, dan "+" dari
 * tempelan dibuang; server menerima format 08…, 628…, maupun 8….
 */
export function PhoneField({ error }: { error?: string }) {
  const t = useT();
  return (
    <Field
      label={t("auth.field.phone")}
      name="phone"
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="tel"
      placeholder={t("auth.field.phone_placeholder")}
      enterKeyHint="next"
      error={error}
      onInput={(e) => digitsOnly(e)}
      required
    />
  );
}
