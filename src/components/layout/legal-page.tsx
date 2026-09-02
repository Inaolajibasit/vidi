import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="editorial-screen font-ui bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-3xl px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-20 sm:px-8 md:py-14">
        <header className="flex items-center justify-between">
          <Link className="font-accent text-accent text-2xl" href="/">
            vidi<span className="text-purple">.</span>
          </Link>
          <Link
            className="text-label text-muted hover:text-foreground min-h-11 content-center"
            href="/"
          >
            Back home
          </Link>
        </header>

        <section className="border-border border-b pt-16 pb-12 md:pt-24 md:pb-16">
          <p className="text-label text-purple">{eyebrow}</p>
          <h1 className="font-display mt-4 text-[clamp(4rem,17vw,8rem)] leading-[0.78] tracking-[-0.05em] uppercase">
            {title}
          </h1>
          <p className="text-muted mt-7 text-sm">Effective 2 September 2026</p>
        </section>

        <article className="legal-copy py-12 md:py-16">{children}</article>

        <footer className="border-border text-muted flex flex-wrap gap-x-5 gap-y-3 border-t pt-8 text-xs">
          <Link
            className="hover:text-foreground underline-offset-4 hover:underline"
            href="/privacy"
          >
            Privacy
          </Link>
          <Link
            className="hover:text-foreground underline-offset-4 hover:underline"
            href="/terms"
          >
            Terms
          </Link>
          <Link
            className="hover:text-foreground underline-offset-4 hover:underline"
            href="/"
          >
            vidi home
          </Link>
        </footer>
      </div>
    </main>
  );
}

export function LegalContact() {
  const email = process.env.NEXT_PUBLIC_LEGAL_EMAIL;

  return email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <span>
      the support address listed on vidi&apos;s authentication consent screen
    </span>
  );
}
