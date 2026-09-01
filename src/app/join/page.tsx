import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { inviteCodeSchema } from "@/features/games/validation";

interface JoinPageProps {
  searchParams: Promise<{ code?: string }>;
}

export const metadata = { title: "Join game" };

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { code } = await searchParams;
  const parsed = code ? inviteCodeSchema.safeParse(code) : null;

  if (parsed?.success) redirect(`/join/${parsed.data}`);

  return (
    <main className="editorial-screen font-ui bg-background min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-8 sm:px-8">
        <header className="flex items-center justify-between">
          <Link
            aria-label="Back to home"
            className="tap-target text-muted hover:text-foreground grid size-11 place-items-center rounded-full transition-colors"
            href="/"
          >
            <Icon name="arrow-left" size={22} />
          </Link>
          <span className="font-accent text-accent text-2xl tracking-[-0.05em]">
            vidi<span className="text-purple">.</span>
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10">
          <p className="text-label text-purple mb-4">Got a code?</p>
          <h1 className="font-display text-[clamp(4rem,20vw,6.5rem)] leading-[0.79] font-normal tracking-[-0.04em] uppercase">
            Join the
            <span className="text-accent block">vidi.</span>
          </h1>

          <form className="mt-10 grid gap-5" method="get">
            <Input
              autoCapitalize="characters"
              autoComplete="off"
              className="text-center font-bold tracking-[0.2em] uppercase"
              defaultValue={code}
              error={
                parsed && !parsed.success
                  ? parsed.error.issues[0]?.message
                  : undefined
              }
              label="Invite code"
              maxLength={6}
              name="code"
              placeholder="V7K4Q2"
              required
            />
            <Button fullWidth size="lg" type="submit">
              Find game
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
