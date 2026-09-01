import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
  label: string;
}

export function Input({
  className,
  error,
  hint,
  id,
  label,
  ...props
}: InputProps) {
  const inputId = id ?? label.toLowerCase().replaceAll(" ", "-");
  const descriptionId = error || hint ? `${inputId}-description` : undefined;

  return (
    <label className="grid gap-2" htmlFor={inputId}>
      <span className="text-label text-muted">{label}</span>
      <input
        aria-describedby={descriptionId}
        aria-invalid={Boolean(error)}
        className={cn(
          "border-border bg-surface text-foreground placeholder:text-subtle focus:border-accent focus:ring-accent/15 h-(--input-height) w-full rounded-md border px-4 text-base transition-[border-color,box-shadow] duration-(--duration-fast) outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40",
          error && "border-danger focus:border-danger focus:ring-danger/15",
          className,
        )}
        id={inputId}
        {...props}
      />
      {(error || hint) && (
        <span
          className={cn("text-xs", error ? "text-danger" : "text-muted")}
          id={descriptionId}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  );
}
