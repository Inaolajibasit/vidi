"use client";
import { RetryButton } from "@/components/ui/retry-button";

import { StatusState } from "@/components/ui/status-state";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="editorial-screen font-ui page-container grid min-h-dvh max-w-md place-items-center py-10">
      <StatusState
        action={<RetryButton reset={reset} />}
        description="The page could not load. Your game data has not been changed."
        eyebrow="Server error"
        title="That didn't load."
        tone="danger"
      />
    </main>
  );
}
