"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, Button, Field } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { errorMessage, fieldErrors } from "@/lib/errors";
import { detectTimezone } from "@/lib/platform";

export default function RegisterPage() {
  const { register } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setErrors({});
    try {
      await register({
        invite_code: String(form.get("invite_code")),
        name: String(form.get("name")),
        email: String(form.get("email")),
        password: String(form.get("password")),
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
      <p className="mt-2 text-muted">Masukkan kode undangan dari tim Anda.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field
          label="Kode undangan"
          name="invite_code"
          autoComplete="off"
          autoCapitalize="characters"
          className="uppercase tracking-widest"
          error={errors.invite_code}
          required
        />
        <Field label="Nama" name="name" autoComplete="name" error={errors.name} required />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          error={errors.email}
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Minimal 8 karakter"
          error={errors.password}
          minLength={8}
          required
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
