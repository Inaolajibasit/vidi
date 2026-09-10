"use client";

import { useTransition } from "react";
import { Button } from "./button";

export function RetryButton({ reset }: { reset: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      loading={pending}
      loadingLabel="Trying again…"
      onClick={() => startTransition(reset)}
    >
      Try again
    </Button>
  );
}
