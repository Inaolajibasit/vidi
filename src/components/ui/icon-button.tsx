import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "outline" | "ghost";
}

export function IconButton({
  children,
  className,
  label,
  size = "md",
  type = "button",
  variant = "outline",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        "tap-target inline-grid cursor-pointer place-items-center rounded-full transition-[color,background-color,border-color,transform,opacity] duration-(--duration-fast) ease-(--ease-out) active:scale-95 disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "size-11",
        size === "md" && "size-12",
        size === "lg" && "size-14",
        variant === "solid" &&
          "bg-accent text-background hover:bg-accent-strong",
        variant === "outline" &&
          "border-border bg-surface text-foreground hover:border-foreground/35",
        variant === "ghost" && "text-foreground hover:bg-surface",
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
