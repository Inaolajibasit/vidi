"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-feedback";
import { updateProfileAction } from "../actions";

export function ProfileForm({
  displayName,
  username,
  avatarUrl,
}: {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
}) {
  const locked = useRef(false);
  const [state, action, pending] = useActionState(
    async (
      previous: import("../validation").ProfileActionState,
      data: FormData,
    ) => {
      try {
        return await updateProfileAction(previous, data);
      } catch {
        return {
          success: false,
          message:
            "Your profile couldn't be saved. Check your connection and try again.",
        };
      } finally {
        locked.current = false;
      }
    },
    {},
  );
  const [edited, setEdited] = useState(false);
  const [values, setValues] = useState({
    displayName,
    username: username ?? "",
    avatarUrl: avatarUrl ?? "",
  });
  const fields = [
    {
      name: "displayName",
      label: "Display name",
      value: displayName,
      maxLength: 50,
    },
    {
      name: "username",
      label: "Username",
      value: username ?? "",
      maxLength: 24,
    },
    {
      name: "avatarUrl",
      label: "Avatar URL (optional)",
      value: avatarUrl ?? "",
      maxLength: 2048,
    },
  ] as const;
  return (
    <form
      action={action}
      className="mt-6 grid gap-4"
      noValidate
      aria-busy={pending}
      onChange={() => setEdited(true)}
      onSubmit={(event) => {
        if (locked.current) {
          event.preventDefault();
          return;
        }
        locked.current = true;
        setEdited(false);
      }}
    >
      <fieldset disabled={pending} className="grid min-w-0 gap-4">
        {fields.map((field) => (
          <div className="grid gap-2" key={field.name}>
            <label className="text-label" htmlFor={`profile-${field.name}`}>
              {field.label}
            </label>
            <input
              id={`profile-${field.name}`}
              name={field.name}
              value={values[field.name]}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }))
              }
              maxLength={field.maxLength}
              required={field.name !== "avatarUrl"}
              type={field.name === "avatarUrl" ? "url" : "text"}
              autoCapitalize={field.name === "username" ? "none" : undefined}
              className="border-border bg-surface focus:border-accent min-h-12 min-w-0 rounded-sm border px-4 outline-none disabled:opacity-60"
              aria-invalid={!edited && Boolean(state.fieldErrors?.[field.name])}
              aria-describedby={
                !edited && state.fieldErrors?.[field.name]
                  ? `profile-${field.name}-error`
                  : undefined
              }
            />
            {!edited && state.fieldErrors?.[field.name] && (
              <p
                id={`profile-${field.name}-error`}
                className="text-danger text-sm"
              >
                {state.fieldErrors[field.name]?.[0]}
              </p>
            )}
          </div>
        ))}
      </fieldset>
      <Button
        type="submit"
        loading={pending}
        loadingLabel="Saving profile…"
        disabled={!edited && state.success === true}
        fullWidth
      >
        {!edited && state.success ? "Profile saved" : "Save profile"}
      </Button>
      <ActionMessage
        success={pending || edited ? undefined : state.success}
        message={
          pending
            ? "Saving your changes…"
            : edited
              ? "You have unsaved changes."
              : state.message
        }
      />
    </form>
  );
}
