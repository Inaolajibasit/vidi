import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

interface HeaderAction {
  icon: IconName;
  label: string;
}

interface PageHeaderProps {
  action?: HeaderAction;
  backLabel?: string;
  className?: string;
  eyebrow?: string;
  title: ReactNode;
}

export function PageHeader({
  action,
  backLabel,
  className,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <header className={cn("flex min-h-20 items-center gap-3 py-3", className)}>
      <div className="w-12 shrink-0">
        {backLabel && (
          <IconButton label={backLabel} variant="ghost">
            <Icon name="arrow-left" />
          </IconButton>
        )}
      </div>
      <div className="min-w-0 flex-1 text-center">
        {eyebrow && <p className="text-label text-purple mb-1">{eyebrow}</p>}
        <h1 className="text-title truncate">{title}</h1>
      </div>
      <div className="w-12 shrink-0">
        {action && (
          <IconButton label={action.label} variant="ghost">
            <Icon name={action.icon} />
          </IconButton>
        )}
      </div>
    </header>
  );
}
