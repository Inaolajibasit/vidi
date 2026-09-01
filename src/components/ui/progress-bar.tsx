"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  className?: string;
  label?: string;
  showValue?: boolean;
  value: number;
  variant?: "accent" | "purple";
}

export function ProgressBar({
  className,
  label = "Progress",
  showValue = false,
  value,
  variant = "accent",
}: ProgressBarProps) {
  const reducedMotion = useReducedMotion();
  const normalizedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("grid gap-2", className)}>
      {(showValue || label) && (
        <div className="text-label flex items-center justify-between gap-4">
          <span className="text-muted">{label}</span>
          {showValue && (
            <span className="text-foreground">
              {Math.round(normalizedValue)}%
            </span>
          )}
        </div>
      )}
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedValue}
        className="bg-foreground/10 h-1.5 overflow-hidden rounded-full"
        role="progressbar"
      >
        <motion.div
          animate={{ width: `${normalizedValue}%` }}
          className={cn(
            "h-full rounded-full",
            variant === "accent" ? "bg-accent" : "bg-purple",
          )}
          initial={false}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", bounce: 0, duration: 0.35 }
          }
        />
      </div>
    </div>
  );
}
