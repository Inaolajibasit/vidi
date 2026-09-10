"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinGameAction } from "@/features/games/lobby-actions";

function JoinButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      loadingLabel="Joining game…"
      disabled={pending}
      fullWidth
      size="lg"
      type="submit"
    >
      {pending ? "Joining…" : "Join game"}
    </Button>
  );
}

export function JoinLobbyForm({
  authenticated,
  inviteCode,
}: {
  authenticated: boolean;
  inviteCode: string;
}) {
  const [state, action] = useActionState(joinGameAction, {});

  return (
    <form action={action} className="grid gap-5" noValidate>
      <input name="inviteCode" type="hidden" value={inviteCode} />
      {authenticated ? (
        <input name="displayName" type="hidden" value="Player" />
      ) : (
        <Input
          autoComplete="nickname"
          error={state.displayNameError}
          label="Your name"
          maxLength={50}
          name="displayName"
          placeholder="What should friends call you?"
          required
        />
      )}
      {state.message ? (
        <p
          className="border-danger/40 bg-danger/10 rounded-md border p-4 text-sm leading-5"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      <JoinButton />
    </form>
  );
}
