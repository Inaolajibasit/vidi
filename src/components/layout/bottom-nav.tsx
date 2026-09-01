import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface BottomNavItem {
  emphasis?: boolean;
  href: string;
  icon: IconName;
  label: string;
}

interface BottomNavProps {
  activeHref: string;
  className?: string;
  items: BottomNavItem[];
}

export function BottomNav({ activeHref, className, items }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "border-foreground/20 fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-md border bg-[var(--surface-overlay)] p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl",
        className,
      )}
    >
      <ul className="grid auto-cols-fr grid-flow-col">
        {items.map((item) => {
          const active = item.href === activeHref;

          return (
            <li key={item.href}>
              <Link
                aria-label={item.emphasis ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap-target text-label flex flex-col items-center justify-center gap-1 rounded-sm px-2 py-2 transition-[color,background-color,transform] duration-150 active:scale-95",
                  item.emphasis
                    ? "bg-accent text-background hover:bg-accent-strong mx-auto size-12 rounded-sm p-0 shadow-[4px_4px_0_#2227F7]"
                    : active
                      ? "bg-accent text-background"
                      : "text-muted hover:bg-foreground/5 hover:text-foreground",
                )}
                href={item.href}
              >
                <Icon name={item.icon} size={item.emphasis ? 23 : 19} />
                <span className={item.emphasis ? "sr-only" : undefined}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
