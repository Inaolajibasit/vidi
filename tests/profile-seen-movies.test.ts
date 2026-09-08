import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { getProfileSeenMovieIds } from "../src/features/profiles/seen-movies";

function clientWith(fetch: typeof globalThis.fetch) {
  return createClient<Database>("https://database.example", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
}

test("profile seen movies include every page and count repeated movies once", async () => {
  let requests = 0;
  const client = clientWith(async (input) => {
    const url = new URL(String(input));
    assert.equal(
      url.searchParams.get("game_players.profile_id"),
      "eq.profile-a",
    );
    assert.equal(url.searchParams.get("seen"), "eq.true");
    assert.equal(
      url.searchParams.get("select"),
      "movie_id,game_players!inner(profile_id)",
    );
    assert.equal(
      url.searchParams.get("order"),
      "game_player_id.asc,movie_id.asc",
    );
    assert.equal(url.searchParams.get("offset"), String(requests * 500));
    assert.equal(url.searchParams.get("limit"), "500");
    const rows =
      requests++ < 2
        ? Array.from({ length: 500 }, (_, i) => ({ movie_id: `movie-${i}` }))
        : [{ movie_id: "movie-after-row-1000" }, { movie_id: "movie-0" }];
    return new Response(JSON.stringify(rows), {
      headers: { "Content-Type": "application/json" },
    });
  });
  const ids = await getProfileSeenMovieIds(client, "profile-a");
  assert.equal(requests, 3);
  assert.equal(ids.length, 501);
  assert.ok(ids.includes("movie-after-row-1000"));
});

test("a profile with no seen answers shows zero", async () => {
  const client = clientWith(async () => new Response("[]"));
  assert.deepEqual(await getProfileSeenMovieIds(client, "profile-a"), []);
});

test("a failed ratings request is not displayed as zero movies seen", async () => {
  const client = clientWith(
    async () =>
      new Response(
        JSON.stringify({ message: "Ratings unavailable", code: "42501" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
  );
  await assert.rejects(getProfileSeenMovieIds(client, "profile-a"));
});
