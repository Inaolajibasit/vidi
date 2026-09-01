import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "accent" | "neutral" | "outline" | "purple";
}

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "text-label inline-flex min-h-6 items-center rounded-full px-2.5 py-1",
        variant === "accent" && "bg-accent text-background",
        variant === "neutral" && "bg-foreground/10 text-foreground",
        variant === "outline" && "border-border text-muted border",
        variant === "purple" && "bg-purple-soft text-purple",
        className,
      )}
      {...props}
    />
  );
}
