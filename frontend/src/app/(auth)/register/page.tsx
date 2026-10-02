"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { Alert, Button, Field } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { PhoneField, PinField } from "@/features/auth/PinField";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { detectTimezone } from "@/lib/platform";

type FunctionOption = { id: string; name: string; parent_id: string | null };

export default function RegisterPage() {
  const { register } = useAuth();
  const selectId = useId();
  const [functions, setFunctions] = useState<FunctionOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api<{ functions: FunctionOption[] }>("/auth/register-options", { auth: false })
      .then((r) => setFunctions(r.functions))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setErrors({});
    try {
      await register({
        name: String(form.get("name")),
        function_id: String(form.get("function_id") ?? ""),
        phone: String(form.get("phone")),
        pin: String(form.get("pin")),
        timezone: detectTimezone(),
      });
    } catch (err) {
      const perField = fieldErrors(err);
      setErrors(perField);
      setError(Object.keys(perField).length ? "Periksa kembali isian Anda." : errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="animate-pop-in">
      <h1 className="text-3xl font-extrabold">Gabung tim baca 📖</h1>
      <p className="mt-2 text-muted">Cukup nama, fungsi, nomor HP, dan PIN.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Nama" name="name" autoComplete="name" error={errors.name} required />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-semibold">
            Fungsi / bagian
          </label>
          <select
            id={selectId}
            name="function_id"
            defaultValue=""
            required
            aria-invalid={errors.function_id ? true : undefined}
            className={`h-12 rounded-2xl border bg-surface px-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 ${
              errors.function_id ? "border-danger" : "border-border"
            }`}
          >
            <option value="" disabled>
              {functions ? "Pilih fungsi…" : "Memuat…"}
            </option>
            {functions?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {errors.function_id && <p className="text-sm text-danger">Pilih fungsi/bagianmu</p>}
        </div>
        <PhoneField error={errors.phone} />
        <PinField
          autoComplete="new-password"
          error={errors.pin}
          hint="Hindari PIN mudah ditebak seperti 123456 atau 111111"
        />
        <Button type="submit" loading={pending} className="mt-2">
          Daftar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-bold text-primary">
          Masuk
        </Link>
      </p>
    </div>
  );
}
