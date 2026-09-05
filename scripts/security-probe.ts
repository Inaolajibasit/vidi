import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

function loadEnvironment(source: string) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim(),
        ];
      }),
  );
}

async function main() {
  const environment = loadEnvironment(await readFile(".env.local", "utf8"));
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey)
    throw new Error("Supabase environment is incomplete.");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  const marker = randomUUID();
  const emailA = `security-probe-a-${marker}@example.com`;
  const emailB = `security-probe-b-${marker}@example.com`;
  let userA: string | null = null;
  let userB: string | null = null;
  let gameId: string | null = null;

  try {
    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      email_confirm: true,
      password,
    });
    if (createdA.error || !createdA.data.user) throw createdA.error;
    userA = createdA.data.user.id;
    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      email_confirm: true,
      password,
    });
    if (createdB.error || !createdB.data.user) throw createdB.error;
    userB = createdB.data.user.id;

    const { data: movie, error: movieError } = await admin
      .from("movies")
      .select("id")
      .limit(1)
      .single();
    if (movieError) throw movieError;

    const inviteCode = randomBytes(6).toString("hex").slice(0, 6).toUpperCase();
    const { data: game, error: gameError } = await admin
      .from("games")
      .insert({
        host_profile_id: userA,
        invite_code: inviteCode,
        max_players: 2,
        mode: "quick",
        status: "waiting",
      })
      .select("created_at, id")
      .single();
    if (gameError) throw gameError;
    gameId = game.id;

    const { data: players, error: playerError } = await admin
      .from("game_players")
      .insert([
        { display_name: "Probe A", game_id: gameId, profile_id: userA },
        { display_name: "Probe B", game_id: gameId, profile_id: userB },
      ])
      .select("id, profile_id");
    if (playerError) throw playerError;
    const playerA = players.find((player) => player.profile_id === userA);
    const playerB = players.find((player) => player.profile_id === userB);
    if (!playerA || !playerB)
      throw new Error("Probe players were not created.");
    const playerBId = playerB.id;

    const { error: startError } = await admin
      .from("games")
      .update({ started_at: game.created_at, status: "active" })
      .eq("id", gameId);
    if (startError) throw startError;

    const { error: deckError } = await admin
      .from("game_movies")
      .insert({ game_id: gameId, movie_id: movie.id, position: 1 });
    if (deckError) throw deckError;
    const { error: ratingError } = await admin.from("ratings").insert([
      {
        game_id: gameId,
        game_player_id: playerA.id,
        movie_id: movie.id,
        seen: false,
      },
      {
        game_id: gameId,
        game_player_id: playerB.id,
        movie_id: movie.id,
        seen: true,
        reaction: "loved",
      },
    ]);
    if (ratingError) throw ratingError;

    const attacker = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    const signIn = await attacker.auth.signInWithPassword({
      email: emailA,
      password,
    });
    if (signIn.error) throw signIn.error;

    async function visibleRatings(
      status: "active" | "waiting_results" | "completed",
    ) {
      const { data, error } = await attacker
        .from("ratings")
        .select("game_player_id, reaction, seen")
        .eq("game_id", gameId!);
      if (error) throw error;
      return {
        status,
        visible: data.length,
          exposedOtherPlayer: data.some(
            (row) => row.game_player_id === playerBId,
        ),
      };
    }

    const active = await visibleRatings("active");
    await admin
      .from("games")
      .update({ status: "waiting_results" })
      .eq("id", gameId);
    const waiting = await visibleRatings("waiting_results");

    const directMutation = await attacker
      .from("ratings")
      .update({ seen: true, reaction: "meh" })
      .eq("game_player_id", playerA.id)
      .eq("movie_id", movie.id)
      .select("game_player_id");

    await admin
      .from("games")
      .update({ completed_at: new Date().toISOString(), status: "completed" })
      .eq("id", gameId);
    const completed = await visibleRatings("completed");

    process.stdout.write(
      `${JSON.stringify({ active, waiting, completed, directRatingMutationAllowed: !directMutation.error && directMutation.data.length > 0 }, null, 2)}\n`,
    );
    if (
      active.exposedOtherPlayer ||
      waiting.exposedOtherPlayer ||
      !completed.exposedOtherPlayer ||
      (!directMutation.error && directMutation.data.length > 0)
    ) {
      throw new Error("Live rating isolation probe failed.");
    }
  } finally {
    if (gameId) await admin.from("games").delete().eq("id", gameId);
    if (userA) await admin.auth.admin.deleteUser(userA);
    if (userB) await admin.auth.admin.deleteUser(userB);
  }
}

void main().catch((error: unknown) => {
  const value = error as { code?: string; message?: string };
  process.stderr.write(
    `${JSON.stringify({ code: value?.code ?? "unknown", message: value?.message ?? "Security probe failed" })}\n`,
  );
  process.exitCode = 1;
});
