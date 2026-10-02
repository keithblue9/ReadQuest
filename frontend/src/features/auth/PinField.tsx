"use client";

import { Field } from "@/components/ui";

type Props = {
  label?: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
};

/**
 * Input PIN 6 angka: keypad angka di HP. Karakter selain angka dibuang lalu dipotong ke 6 digit
 * (tanpa `maxLength`, agar tempelan seperti "12-34 56" tidak terpotong sebelum dibersihkan).
 */
export function PinField({ label = "PIN (6 angka)", name = "pin", autoComplete, error, hint }: Props) {
  return (
    <Field
      label={label}
      name={name}
      type="password"
      inputMode="numeric"
      pattern="[0-9]{6}"
      autoComplete={autoComplete}
      className="tracking-[0.5em]"
      error={error}
      hint={hint}
      onInput={(e) => {
        e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 6);
      }}
      required
    />
  );
}

/** Input nomor HP (keypad telepon). */
export function PhoneField({ error }: { error?: string }) {
  return (
    <Field
      label="Nomor HP"
      name="phone"
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="0812 3456 7890"
      error={error}
      required
    />
  );
}
