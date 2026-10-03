"use client";

import { useEffect, useState } from "react";

import { Alert } from "@/components/ui";
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

export default function TeamPage() {
  const [data, setData] = useState<AuthenticityTeam | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AuthenticityTeam>("/authenticity/team")
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-2xl font-bold">Authenticity Index Tim 🧭</h1>
        <p className="mt-1 text-sm text-muted">
          Rasio kontribusi 30 hari: catatan sendiri ÷ (catatan + komentar + like). Bersifat privat —
          hanya untukmu sebagai Team Lead/Admin, bukan untuk dibagikan.
        </p>
      </div>
      {error && <Alert>{error}</Alert>}
      {data && (
        <>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {ORDER.map((s) => (
              <div key={s} className="rounded-2xl border border-border bg-surface p-2">
                <dt className="text-[11px] font-semibold text-muted">{LABEL[s]}</dt>
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
