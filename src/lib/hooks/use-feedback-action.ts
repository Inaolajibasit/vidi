"use client";

import { useRef, useState } from "react";
import { useActionFeedback } from "@/components/ui/action-feedback";

export function useFeedbackAction() {
  const locked = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const notify = useActionFeedback();
  async function run(
    name: string,
    action: () => Promise<string>,
    failureMessage: string,
  ) {
    if (locked.current) return;
    locked.current = true;
    setPending(name);
    try {
      const message = await action();
      notify({ success: true, message });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        notify({ success: false, message: failureMessage });
      }
    } finally {
      locked.current = false;
      setPending(null);
    }
  }
  return { pending, run };
}
