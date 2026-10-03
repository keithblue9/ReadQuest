"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, Button, FullScreenSpinner, Logo } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { IOSInstallGuide } from "@/features/onboarding/IOSInstallGuide";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { detectTimezone, needsIOSInstallGuide } from "@/lib/platform";
import type { Me, OnboardingOptions } from "@/lib/types";

const TARGET_PRESETS = [15, 20, 30, 45, 60];
type Step = "function" | "interests" | "target" | "install";

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const router = useRouter();

  const [options, setOptions] = useState<OnboardingOptions | null>(null);
  // Fungsi sudah dipilih saat daftar → onboarding mulai dari minat baca.
  const [skipFunction] = useState(() => Boolean(user?.function_id));
  const [step, setStep] = useState<Step>(skipFunction ? "interests" : "function");
  const [functionId, setFunctionId] = useState<string | null>(user?.function_id ?? null);
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [target, setTarget] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api<OnboardingOptions>("/me/onboarding/options")
      .then(setOptions)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (!options) {
    return error ? (
      <main className="mx-auto max-w-md p-5">
        <Alert>{error}</Alert>
      </main>
    ) : (
      <FullScreenSpinner />
    );
  }

  const minTarget = options.daily_target_min_minutes;
  const presets = TARGET_PRESETS.filter((m) => m >= minTarget);
  const savedTarget = user?.onboarding_completed ? user.daily_target_minutes : null;
  const dailyTarget = target ?? savedTarget ?? options.daily_target_default_minutes;
  const showInstall = step === "install";
  const steps: Step[] = skipFunction ? ["interests", "target"] : ["function", "interests", "target"];
  const stepIndex = steps.indexOf(step);
  const canGoBack = step === "target" || (step === "interests" && !skipFunction);

  function toggleInterest(id: string) {
    setInterests((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(0, 10),
    );
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const me = await api<Me>("/me/onboarding", {
        method: "PUT",
        json: {
          function_id: functionId,
          interests,
          daily_target_minutes: dailyTarget,
          timezone: detectTimezone(),
        },
      });
      setUser(me);
      if (needsIOSInstallGuide()) setStep("install");
      else router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <Logo />
        {!showInstall && (
          <span className="text-sm font-semibold text-muted">Langkah {stepIndex + 1}/{steps.length}</span>
        )}
      </header>
      {!showInstall && (
        <div className="mt-4 flex gap-2" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>
      )}

      <div key={step} className="animate-pop-in mt-8 flex-1">
        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {step === "function" && (
          <fieldset>
            <legend className="text-2xl font-bold">Kamu dari fungsi mana? 🏢</legend>
            <p className="mt-2 text-muted">Poinmu ikut menyumbang di Battle Antar-Fungsi.</p>
            <div className="mt-6 flex flex-col gap-2">
              {options.functions.map((fn) => (
                <label
                  key={fn.id}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 font-semibold transition ${
                    functionId === fn.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:bg-surface-muted"
                  }`}
                >
                  {fn.name}
                  <input
                    type="radio"
                    name="function"
                    value={fn.id}
                    checked={functionId === fn.id}
                    onChange={() => setFunctionId(fn.id)}
                    className="size-5 accent-[var(--primary)]"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {step === "interests" && (
          <fieldset>
            <legend className="text-2xl font-bold">Suka baca tentang apa? 📚</legend>
            <p className="mt-2 text-muted">Pilih minimal satu. Bisa diubah kapan saja.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {options.categories.map((cat) => {
                const selected = interests.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleInterest(cat.id)}
                    className={`rounded-full border px-4 py-2 font-semibold transition active:scale-95 ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface hover:bg-surface-muted"
                    }`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {step === "target" && (
          <fieldset>
            <legend className="text-2xl font-bold">Target baca harian ⏱️</legend>
            <p className="mt-2 text-muted">
              Minimal {minTarget} menit sehari. Mulai dari yang realistis!
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {presets.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={dailyTarget === minutes}
                  onClick={() => setTarget(minutes)}
                  className={`rounded-2xl border p-4 text-center transition active:scale-95 ${
                    dailyTarget === minutes
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface hover:bg-surface-muted"
                  }`}
                >
                  <span className="block text-2xl font-bold">{minutes}</span>
                  <span className="text-xs font-semibold opacity-80">menit</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === "install" && <IOSInstallGuide />}
      </div>

      <div
        className={`grid gap-3 pt-6 ${
          canGoBack ? "grid-cols-[1fr_2fr]" : "grid-cols-1"
        }`}
      >
        {canGoBack ? (
          <Button
            variant="ghost"
            onClick={() => setStep(step === "target" ? "interests" : "function")}
          >
            Kembali
          </Button>
        ) : null}
        {step === "function" && (
          <Button disabled={!functionId} onClick={() => setStep("interests")}>
            Lanjut
          </Button>
        )}
        {step === "interests" && (
          <Button disabled={interests.length === 0} onClick={() => setStep("target")}>
            Lanjut
          </Button>
        )}
        {step === "target" && (
          <Button loading={pending} onClick={submit}>
            Mulai membaca 🚀
          </Button>
        )}
        {step === "install" && <Button onClick={() => router.replace("/")}>Selesai</Button>}
      </div>
    </main>
  );
}
