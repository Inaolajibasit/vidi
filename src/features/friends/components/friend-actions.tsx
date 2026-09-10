"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  acceptFriendRequestAction,
  declineFriendRequestAction,
  deleteFriendshipAction,
  sendFriendRequestAction,
  type FriendActionState,
} from "@/features/friends/actions";
import { cn } from "@/lib/utils";

function Submit({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "danger" | "primary" | "quiet";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      variant={variant === "primary" ? "primary" : "outline"}
      className={cn(
        "min-h-11 rounded-sm px-4 text-xs font-extrabold tracking-[0.04em] uppercase transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-50",
        variant === "primary" && "bg-accent text-background",
        variant === "quiet" && "border-border text-foreground border",
        variant === "danger" && "text-danger border-danger/50 border",
      )}
      disabled={pending}
      loadingLabel="Updating friendship…"
      type="submit"
    >
      {pending ? "Working…" : children}
    </Button>
  );
}

function Feedback({ state }: { state: FriendActionState }) {
  return state.message ? (
    <p
      aria-live="polite"
      className={cn(
        "mt-2 text-xs",
        state.success ? "text-accent" : "text-danger",
      )}
    >
      {state.message}
    </p>
  ) : null;
}

export function AddFriendForm({
  defaultUsername = "",
}: {
  defaultUsername?: string;
}) {
  const [state, action] = useActionState(sendFriendRequestAction, {});
  return (
    <form action={action}>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="friend-username">
          Username
        </label>
        <input
          autoCapitalize="none"
          autoComplete="off"
          className="border-border bg-surface focus-visible:border-accent min-h-12 min-w-0 flex-1 rounded-sm border px-4 text-sm focus-visible:outline-none"
          defaultValue={defaultUsername}
          id="friend-username"
          name="username"
          pattern="[a-zA-Z0-9_]{3,24}"
          placeholder="username"
          required
        />
        <Submit>Add</Submit>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function FriendshipAction({
  friendshipId,
  kind,
}: {
  friendshipId: string;
  kind: "accept" | "decline" | "remove";
}) {
  const serverAction =
    kind === "accept"
      ? acceptFriendRequestAction
      : kind === "decline"
        ? declineFriendRequestAction
        : deleteFriendshipAction;
  const [state, action] = useActionState(serverAction, {});
  return (
    <form action={action}>
      <input name="friendshipId" type="hidden" value={friendshipId} />
      <Submit
        variant={
          kind === "remove"
            ? "danger"
            : kind === "decline"
              ? "quiet"
              : "primary"
        }
      >
        {kind}
      </Submit>
      <Feedback state={state} />
    </form>
  );
}
