"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, Button } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { PhoneField, PinField } from "@/features/auth/PinField";
import { errorMessage, fieldErrors } from "@/lib/errors";

export default function LoginPage() {
  const { login } = useAuth();
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
      await login(String(form.get("phone")), String(form.get("pin")));
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="animate-pop-in">
      <h1 className="text-3xl font-extrabold">Selamat datang kembali 👋</h1>
      <p className="mt-2 text-muted">Masuk dengan nomor HP dan PIN-mu.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <PhoneField error={errors.phone} />
        <PinField autoComplete="current-password" error={errors.pin} />
        <Button type="submit" loading={pending} className="mt-2">
          Masuk
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">Lupa PIN? Hubungi Admin tim untuk reset.</p>
      <p className="mt-2 text-center text-sm text-muted">
        Belum punya akun?{" "}
        <Link href="/register" className="font-bold text-primary">
          Daftar di sini
        </Link>
      </p>
    </div>
  );
}
