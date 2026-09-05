"use client";

import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { trackAnalytics } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

interface HomeActionLinkProps {
  href: string;
  label: string;
  primary?: boolean;
  trackCreate?: boolean;
}

export function HomeActionLink({
  href,
  label,
  primary = false,
  trackCreate = false,
}: HomeActionLinkProps) {
  return (
    <Link
      className={cn(
        "tap-target group flex h-15 w-full items-center justify-between rounded-sm border px-5 text-xs font-extrabold tracking-[0.09em] uppercase shadow-[0_0_0_0_transparent] transition-[color,background-color,border-color,transform,box-shadow] duration-150 ease-out active:scale-[0.965]",
        primary
          ? "border-accent bg-accent text-background hover:bg-accent-strong hover:shadow-[5px_5px_0_#2227F7]"
          : "border-foreground/55 bg-background/70 text-foreground hover:border-foreground hover:bg-foreground hover:text-background backdrop-blur-sm",
      )}
      href={href}
      onClick={
        trackCreate
          ? () => trackAnalytics("create_game_clicked", {})
          : undefined
      }
    >
      <span>{label}</span>
      <Icon
        className="transition-transform duration-150 group-hover:translate-x-1"
        name="chevron-right"
        size={18}
      />
    </Link>
  );
}
