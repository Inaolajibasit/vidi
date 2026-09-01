import { cn } from "@/lib/utils";

interface DividerProps {
  className?: string;
  label?: string;
}

export function Divider({ className, label }: DividerProps) {
  if (!label) {
    return <hr className={cn("border-border border-0 border-t", className)} />;
  }

  return (
    <div className={cn("flex items-center gap-3", className)} role="separator">
      <span className="bg-border h-px flex-1" />
      <span className="text-label text-subtle">{label}</span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
