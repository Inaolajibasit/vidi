"use client";

import { useActionState, useRef, type ReactNode } from "react";
import {
  ActionMessage,
  useActionFeedback,
  type ActionFeedback,
} from "./action-feedback";
import { ButtonCompletedContext } from "./button";

// For mutations that stay on the page. Redirecting actions use a normal form.
export function ActionForm({
  action,
  children,
  className,
  successMessage,
}: {
  action: (data: FormData) => Promise<void | ActionFeedback>;
  children: ReactNode;
  className?: string;
  successMessage: string;
}) {
  const notify = useActionFeedback();
  const lock = useRef(false);
  const [state, submit, pending] = useActionState(
    async (_previous: ActionFeedback | null, data: FormData) => {
      try {
        const result = await action(data);
        const feedback = result ?? { success: true, message: successMessage };
        notify(feedback);
        return feedback;
      } catch {
        const feedback = {
          success: false,
          message: "That didn't save. Check your connection and try again.",
        };
        notify(feedback);
        return feedback;
      } finally {
        lock.current = false;
      }
    },
    null,
  );
  return (
    <ButtonCompletedContext.Provider
      value={Boolean(state?.success) && !pending}
    >
      <form
        action={submit}
        className={className}
        aria-busy={pending}
        onSubmit={(event) => {
          if (lock.current) event.preventDefault();
          else lock.current = true;
        }}
      >
        {children}
        {!pending && state && !state.success && <ActionMessage {...state} />}
      </form>
    </ButtonCompletedContext.Provider>
  );
}
