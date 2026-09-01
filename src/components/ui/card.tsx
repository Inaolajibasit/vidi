import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "strong" | "outline" | "purple";
}

export function Card({
  className,
  padding = "md",
  variant = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        variant === "default" && "border-border bg-surface",
        variant === "strong" && "border-border bg-surface-strong",
        variant === "outline" && "border-border bg-transparent",
        variant === "purple" && "border-purple/25 bg-purple-soft",
        padding === "sm" && "p-4",
        padding === "md" && "p-(--card-padding)",
        padding === "lg" && "p-6 sm:p-8",
        className,
      )}
      {...props}
    />
  );
}
