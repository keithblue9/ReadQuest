"use client";

import { Suspense } from "react";

import { FullScreenSpinner } from "@/components/ui";
import { FeedView } from "@/features/feed/FeedView";

export default function FeedPage() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">Feed tim</h1>
      <Suspense fallback={<FullScreenSpinner />}>
        <FeedView basePath="/feed" />
      </Suspense>
    </div>
  );
}
