"use client";

import { useEffect, useState } from "react";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Alert, BUTTON_BASE, BUTTON_SIZES, BUTTON_VARIANTS, EmptyState } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { StatusBadge } from "@/features/authenticity/StatusBadge";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { AuthenticityStatus, AuthenticityTeam } from "@/lib/types";

const ORDER: AuthenticityStatus[] = ["active_reader", "warming_up", "observer", "silent"];
const LABEL: Record<AuthenticityStatus, string> = {
  active_reader: "Active Reader",
  warming_up: "Warming Up",
  observer: "Observer",
  silent: "Silent",
};

/** Izin yang membuka halaman ini (sama dengan pengecekan di backend). */
const TEAM_PERMISSIONS = ["authenticity.view_team", "authenticity.view_all"];

export default function TeamPage() {
  const { user } = useAuth();
  const allowed = !!user?.permissions.some((p) => TEAM_PERMISSIONS.includes(p));
  const [data, setData] = useState<AuthenticityTeam | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    api<AuthenticityTeam>("/authenticity/team")
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [allowed]);

  if (user && !allowed) {
    return (
      <div className="pt-2">
        <h1 className="sr-only">Authenticity Index tim</h1>
        <EmptyState
          icon={<ShieldCheck className="size-6" />}
          title="Khusus Team Lead dan Admin"
          body="Halaman ini menampilkan status membaca anggota fungsi yang kamu pimpin. Statusmu sendiri ada di Profil."
          action={
            <Link href="/profile" className={`${BUTTON_BASE} ${BUTTON_SIZES.sm} ${BUTTON_VARIANTS.primary}`}>
              Lihat profilku
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-[26px] leading-tight">Authenticity Index Tim</h1>
        <p className="mt-1 text-sm text-muted">
          Rasio kontribusi 30 hari: catatan sendiri ÷ (catatan + komentar + like). Bersifat privat —
          hanya untukmu sebagai Team Lead/Admin, bukan untuk dibagikan.
        </p>
      </div>
      {error && <Alert>{error}</Alert>}
      {data && (
        <>
          <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {ORDER.map((s) => (
              <div key={s} className="rounded-2xl border border-border bg-surface p-2">
                <dt className="text-xs font-semibold text-muted">{LABEL[s]}</dt>
                <dd className="text-xl font-bold">{data.counts[s]}</dd>
              </div>
            ))}
          </dl>
          <ul className="divide-y divide-border rounded-3xl border border-border bg-surface">
            {data.members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="text-xs text-muted">
                    {m.own_notes} catatan · {m.comments_given} komentar · {m.likes_given} like ·
                    rasio {Math.round(m.contribution_ratio * 100)}%
                  </p>
                </div>
                <StatusBadge status={m.status} label={m.status_label} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
