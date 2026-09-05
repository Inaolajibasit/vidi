import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface StatusStateProps {
  action?: ReactNode;
  className?: string;
  description: string;
  eyebrow?: string;
  title: string;
  tone?: "danger" | "neutral" | "purple";
}

export const statusActionClassName =
  "tap-target bg-accent text-background inline-flex min-h-14 w-full items-center justify-center rounded-md px-6 text-sm font-extrabold tracking-[0.06em] uppercase transition-transform active:scale-[0.975]";

export function StatusAction({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <Link className={statusActionClassName} href={href}>
      {children}
      <Icon className="ml-2" name="chevron-right" size={17} />
    </Link>
  );
}

export function StatusState({
  action,
  className,
  description,
  eyebrow = "Something changed",
  title,
  tone = "neutral",
}: StatusStateProps) {
  return (
    <section
      aria-labelledby="status-state-title"
      className={cn("w-full", className)}
    >
      <div
        aria-hidden="true"
        className={cn(
          "mb-7 h-2 w-16",
          tone === "danger"
            ? "bg-danger"
            : tone === "purple"
              ? "bg-purple"
              : "bg-accent",
        )}
      />
      <p
        className={cn(
          "text-label",
          tone === "danger"
            ? "text-danger"
            : tone === "purple"
              ? "text-purple"
              : "text-muted",
        )}
      >
        {eyebrow}
      </p>
      <h1
        className="font-display mt-4 text-[clamp(3rem,15vw,4.75rem)] leading-[0.82] tracking-[-0.045em] uppercase"
        id="status-state-title"
      >
        {title}
      </h1>
      <p className="text-muted mt-6 max-w-sm text-base leading-6">
        {description}
      </p>
      {action ? <div className="mt-8">{action}</div> : null}
    </section>
  );
}

export function StatusScreen(props: StatusStateProps) {
  return (
    <main className="editorial-screen font-ui page-container grid min-h-dvh max-w-md place-items-center pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full">
        <Link
          aria-label="vidi home"
          className="font-accent text-accent inline-flex min-h-11 items-center text-2xl"
          href="/"
        >
          vidi<span className="text-purple">.</span>
        </Link>
        <StatusState className="mt-14" {...props} />
      </div>
    </main>
  );
}
