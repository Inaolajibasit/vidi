"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface ActionFeedback {
  success: boolean;
  message: string;
}

const FeedbackContext = createContext<(feedback: ActionFeedback) => void>(
  () => {},
);

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<
    (ActionFeedback & { id: number }) | null
  >(null);
  const notify = useCallback(
    (value: ActionFeedback) => setFeedback({ ...value, id: Date.now() }),
    [],
  );
  useEffect(() => {
    if (!feedback?.success) return;
    const timer = window.setTimeout(() => setFeedback(null), 6000);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  return (
    <FeedbackContext.Provider value={notify}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-[max(6rem,env(safe-area-inset-bottom))] z-[250] mx-auto max-w-md"
        aria-live="polite"
        aria-atomic="true"
      >
        {feedback && (
          <div
            className={`bg-background pointer-events-auto flex items-start gap-3 rounded-sm border p-4 shadow-[4px_4px_0_#2227F7] ${feedback.success ? "border-accent" : "border-danger"}`}
            key={feedback.id}
          >
            <span
              aria-hidden="true"
              className={feedback.success ? "text-accent" : "text-danger"}
            >
              {feedback.success ? "✓" : "!"}
            </span>
            <p className="min-w-0 flex-1 text-sm font-bold">
              {feedback.message}
            </p>
            <button
              aria-label="Dismiss notification"
              className="-m-2 grid min-h-11 min-w-11 place-items-center"
              onClick={() => setFeedback(null)}
              type="button"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useActionFeedback() {
  return useContext(FeedbackContext);
}

export function ActionMessage({ success, message }: Partial<ActionFeedback>) {
  return (
    <p
      role={success === false ? "alert" : "status"}
      className={`min-h-5 text-sm ${success === false ? "text-danger" : "text-accent"}`}
    >
      {message}
    </p>
  );
}
