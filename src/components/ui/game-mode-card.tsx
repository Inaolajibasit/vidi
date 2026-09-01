import type { ButtonHTMLAttributes } from "react";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface GameModeCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  description: string;
  duration: string;
  movieCount: number;
  selected?: boolean;
  title: string;
}

export function GameModeCard({
  className,
  description,
  duration,
  movieCount,
  selected,
  title,
  type = "button",
  ...props
}: GameModeCardProps) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "border-border bg-surface hover:border-foreground/30 tap-target group w-full cursor-pointer rounded-lg border p-5 text-left transition-[border-color,background-color,transform] duration-(--duration-fast) ease-(--ease-out) active:scale-[0.985]",
        selected && "border-accent bg-accent/[0.06]",
        className,
      )}
      type={type}
      {...props}
    >
      <span className="mb-8 flex items-start justify-between gap-4">
        <Badge variant={selected ? "accent" : "outline"}>
          {movieCount} movies
        </Badge>
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full border",
            selected
              ? "border-accent bg-accent text-background"
              : "border-border text-transparent",
          )}
        >
          <Icon name="check" size={15} />
        </span>
      </span>
      <span className="font-display text-4xl leading-none font-extrabold tracking-[-0.04em] uppercase">
        {title}
      </span>
      <span className="text-muted mt-2 block text-sm">{description}</span>
      <span className="text-label text-purple mt-5 block">{duration}</span>
    </button>
  );
}
