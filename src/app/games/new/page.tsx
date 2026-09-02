import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { CreateGameForm } from "@/features/games/components/create-game-form";
import { getCreateGameIdentity } from "@/features/games/create-game-data";
import { getFriendshipWith } from "@/features/friends/data";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

export const metadata = { title: "Create game" };

export default async function CreateGamePage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const identity = await getCreateGameIdentity();
  const requestedFriend = z
    .string()
    .regex(/^[A-Za-z0-9_]{3,24}$/)
    .safeParse((await searchParams).with);
  let friend: {
    display_name: string;
    id: string;
    username: string | null;
  } | null = null;
  if (requestedFriend.success) {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("profiles")
      .select("id, username, display_name")
      .eq("username", requestedFriend.data)
      .maybeSingle();
    if (data) {
      const relationship = await getFriendshipWith(data.id);
      if (relationship.relationship?.status === "accepted") friend = data;
    }
  }

  return (
    <main className="editorial-screen font-ui bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-3xl px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16 sm:px-8 md:py-14">
        <header className="mb-12 flex items-center justify-between md:mb-16">
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

        <section className="mb-12 md:mb-16">
          <p className="text-label text-purple mb-4">New game</p>
          <h1 className="font-display text-[clamp(4rem,18vw,7.5rem)] leading-[0.78] font-normal tracking-[-0.04em] uppercase">
            Make your
            <span className="text-accent block">vidi.</span>
          </h1>
        </section>

        {friend ? (
          <aside className="border-purple bg-purple/10 mb-10 border-l-2 px-5 py-4">
            <p className="text-label text-purple">Playing with</p>
            <p className="mt-2 font-bold">{friend.display_name}</p>
            <p className="text-muted mt-1 text-sm">
              Build the game, then send them the lobby link.
            </p>
          </aside>
        ) : null}

        <CreateGameForm {...identity} />
      </div>
    </main>
  );
}
