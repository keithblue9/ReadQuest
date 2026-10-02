"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { OnboardingOptions } from "@/lib/types";

type CategoryOption = OnboardingOptions["categories"][number];

let cache: CategoryOption[] | null = null;

export function useCategories(): CategoryOption[] {
  const [categories, setCategories] = useState<CategoryOption[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    api<OnboardingOptions>("/me/onboarding/options")
      .then((options) => {
        cache = options.categories;
        setCategories(options.categories);
      })
      .catch(() => undefined);
  }, []);
  return categories;
}
