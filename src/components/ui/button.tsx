import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "purple";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-background hover:bg-accent-strong",
  secondary: "bg-foreground text-background hover:bg-white",
  outline:
    "border-border bg-transparent text-foreground hover:border-foreground/35 hover:bg-surface",
  ghost: "bg-transparent text-foreground hover:bg-surface",
  purple: "bg-purple text-background hover:brightness-110",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-(--button-height-sm) px-4 text-xs",
  md: "h-(--button-height-md) px-5 text-sm",
  lg: "h-(--button-height-lg) px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
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
  leadingIcon,
  size = "md",
  trailingIcon,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "tap-target inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-bold tracking-[0.04em] uppercase transition-[color,background-color,border-color,transform,opacity] duration-(--duration-fast) ease-(--ease-out) active:scale-[0.975] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled}
      type={type}
      {...props}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  );
}
