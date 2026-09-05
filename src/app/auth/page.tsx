import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const raw = (await searchParams).next;
  const next = raw?.startsWith("/") ? raw : "/profile";
  return (
    <main className="editorial-screen font-ui page-container min-h-dvh max-w-md pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Link className="font-accent text-accent text-2xl" href="/">
        vidi.
      </Link>
      <section className="py-12 min-[390px]:py-16">
        <p className="text-label text-purple">Keep your taste</p>
        <h1 className="text-display-lg mt-4">
          Save your
          <br />
          <span className="text-accent">movie profile.</span>
        </h1>
        <p className="text-muted mt-6 leading-6">
          No password to remember. We’ll email a secure one-time link or code.
        </p>
        <div className="mt-10">
          <AuthForm next={next} />
        </div>
        <p className="text-muted mt-7 text-center text-xs leading-5">
          By continuing, you agree to the{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/terms"
          >
            Terms
          </Link>{" "}
          and acknowledge the{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/privacy"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
