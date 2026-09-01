import { cn } from "@/lib/utils";

interface StatProps {
  className?: string;
  detail?: string;
  label: string;
  tone?: "default" | "accent" | "purple";
  value: string | number;
}

export function Stat({
  className,
  detail,
  label,
  tone = "default",
  value,
}: StatProps) {
  return (
    <div className={cn("grid gap-1", className)}>
      <span className="text-label text-muted">{label}</span>
      <strong
        className={cn(
          "font-display text-4xl leading-none font-bold tracking-[-0.04em]",
          tone === "accent" && "text-accent",
          tone === "purple" && "text-purple",
        )}
      >
        {value}
      </strong>
      {detail && <span className="text-muted text-sm">{detail}</span>}
    </div>
  );
}
