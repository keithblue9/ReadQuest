"use client";

import { useState } from "react";

import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/errors";

import { PinField } from "./PinField";

/** Ganti PIN sendiri (butuh PIN lama). */
export function ChangePinCard() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setPending(true);
    setError(null);
    setErrors({});
    try {
      await api("/me/pin", {
        method: "PUT",
        json: { current_pin: String(form.get("current_pin")), new_pin: String(form.get("new_pin")) },
      });
      formEl.reset();
      setDone(true);
      setOpen(false);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-3">
      <button
        type="button"
        aria-expanded={open}
        className="w-full text-center font-bold"
        onClick={() => {
          setOpen((v) => !v);
          setDone(false);
        }}
      >
        🔑 Ganti PIN
      </button>
      {done && (
        <p role="status" className="mt-2 text-center text-sm font-semibold text-success">
          PIN berhasil diganti ✓
        </p>
      )}
      {open && (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3" noValidate>
          {error && <Alert>{error}</Alert>}
          <PinField label="PIN saat ini" name="current_pin" autoComplete="current-password" error={errors.current_pin} />
          <PinField label="PIN baru (6 angka)" name="new_pin" autoComplete="new-password" error={errors.new_pin} />
          <Button type="submit" loading={pending}>
            Simpan PIN baru
          </Button>
        </form>
      )}
    </section>
  );
}
