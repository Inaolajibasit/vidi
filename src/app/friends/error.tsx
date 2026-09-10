"use client";
import { RetryButton } from "@/components/ui/retry-button";

import { StatusState } from "@/components/ui/status-state";

export default function FriendsError({ reset }: { reset: () => void }) {
  return (
    <main className="editorial-screen font-ui page-container grid min-h-dvh max-w-md place-items-center">
      <StatusState
        action={<RetryButton reset={reset} />}
        description="Your friendships have not changed. Check your connection and try again."
        eyebrow="Friends unavailable"
        title="Lost the connection."
        tone="danger"
      />
    </main>
  );
}
