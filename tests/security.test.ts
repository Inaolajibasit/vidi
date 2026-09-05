import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { safeInternalPath } from "../src/lib/security/redirects";

test("authentication redirects accept only local application paths", () => {
  assert.equal(safeInternalPath("/profile", "/"), "/profile");
  assert.equal(
    safeInternalPath("/join/ABC123?from=mail", "/"),
    "/join/ABC123?from=mail",
  );
  assert.equal(safeInternalPath("https://attacker.example", "/"), "/");
  assert.equal(safeInternalPath("//attacker.example", "/"), "/");
  assert.equal(safeInternalPath("/\\attacker.example", "/"), "/");
  assert.equal(safeInternalPath("/%0aLocation:evil", "/"), "/%0aLocation:evil");
  assert.equal(safeInternalPath(null, "/profile"), "/profile");
});

test("ratings stay private until the game is completed", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/202609050001_security_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /g\.status = 'completed'/);
  assert.doesNotMatch(migration, /g\.status in \([^)]*waiting_results/);
  assert.match(
    migration,
    /revoke insert, update, delete on public\.ratings from authenticated/,
  );
  assert.match(
    migration,
    /drop policy if exists "players can read their ratings before results"|create or replace function private\.results_visible/,
  );
});
