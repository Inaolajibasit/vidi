"use client";

import {
  createContext,
  useContext,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "purple";
type ButtonSize = "sm" | "md" | "lg";
export const ButtonPendingContext = createContext(false);
export const ButtonCompletedContext = createContext(false);

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-background hover:bg-accent-strong",
  secondary: "bg-foreground text-background hover:bg-white",
  outline:
    "border-border bg-transparent text-foreground hover:border-foreground/35 hover:bg-surface",
  ghost: "bg-transparent text-foreground hover:bg-surface",
  purple: "bg-purple text-foreground hover:brightness-110",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-(--button-height-sm) px-4 text-xs",
  md: "h-(--button-height-md) px-5 text-sm",
  lg: "h-(--button-height-lg) px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  completedLabel?: string;
  leadingIcon?: ReactNode;
  size?: ButtonSize;
  trailingIcon?: ReactNode;
  variant?: ButtonVariant;
}

export function Button({
  children,
  className,
  disabled,
  fullWidth,
  loading = false,
  loadingLabel = "Working…",
  completedLabel = "Done",
  leadingIcon,
  size = "md",
  trailingIcon,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const { pending } = useFormStatus();
  const navigating = useContext(ButtonPendingContext);
  const completed = useContext(ButtonCompletedContext) && type === "submit";
  const busy = loading || (type === "submit" && (pending || navigating));
  return (
    <button
      className={cn(
        "tap-target inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm font-extrabold tracking-[0.07em] uppercase transition-[color,background-color,border-color,transform,opacity,box-shadow] duration-150 ease-out hover:shadow-[4px_4px_0_#2227F7] active:scale-[0.965] active:shadow-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || busy || completed}
      type={type}
      {...props}
      aria-busy={busy || undefined}
      aria-label={
        busy && props["aria-label"] ? loadingLabel : props["aria-label"]
      }
    >
      {busy ? (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
      ) : (
        leadingIcon
      )}
      <span
        aria-live="polite"
        className={busy && props["aria-label"] ? "sr-only" : undefined}
      >
        {busy ? loadingLabel : completed ? completedLabel : children}
      </span>
      {!busy && trailingIcon}
    </button>
  );
}
