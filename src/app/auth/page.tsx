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
    <main className="page-container min-h-dvh max-w-md py-10">
      <Link className="text-accent text-xl font-bold" href="/">
        vidi.
      </Link>
      <section className="py-16">
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
      </section>
    </main>
  );
}
