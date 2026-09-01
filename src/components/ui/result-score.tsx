import { cn } from "@/lib/utils";

interface ResultScoreProps {
  caption?: string;
  className?: string;
  label: string;
  score: number;
  tone?: "accent" | "purple";
}

export function ResultScore({
  caption,
  className,
  label,
  score,
  tone = "accent",
}: ResultScoreProps) {
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));

  return (
    <div
      className={cn("grid justify-items-center gap-2 text-center", className)}
    >
      <span className="text-label text-muted">{label}</span>
      <strong
        className={cn(
          "font-display text-[clamp(5rem,28vw,9rem)] leading-[0.78] font-black tracking-[-0.07em]",
          tone === "accent" ? "text-accent" : "text-purple",
        )}
      >
        {normalizedScore}
        <span className="text-[0.32em] tracking-[-0.03em]">%</span>
      </strong>
      {caption && (
        <p className="text-foreground max-w-sm text-lg font-medium tracking-[-0.025em]">
          {caption}
        </p>
      )}
    </div>
  );
}
