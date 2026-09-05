import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import manifest from "../src/app/manifest";

test("manifest provides install and standalone metadata", () => {
  const metadata = manifest();

  assert.equal(metadata.name, "vidi — seen it? prove it.");
  assert.equal(metadata.short_name, "vidi");
  assert.equal(metadata.display, "standalone");
  assert.equal(metadata.start_url, "/");
  assert.equal(metadata.scope, "/");
  assert.equal(metadata.theme_color, "#090909");
  assert.ok(metadata.icons?.some((icon) => icon.sizes === "192x192"));
  assert.ok(metadata.icons?.some((icon) => icon.sizes === "512x512"));
  assert.ok(metadata.icons?.some((icon) => icon.purpose === "maskable"));
});

test("install icons have the declared PNG dimensions", async () => {
  for (const [file, size] of [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["icon-maskable-512.png", 512],
    ["apple-touch-icon.png", 180],
  ] as const) {
    const png = await readFile(new URL(`../public/${file}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

test("service worker only intercepts failed document navigation", async () => {
  const worker = await readFile(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );

  assert.match(worker, /event\.request\.mode !== "navigate"/);
  assert.match(worker, /fetch\(event\.request\)\.catch/);
  assert.doesNotMatch(worker, /request\.url|\/api\//);
});

test("offline fallback is self-contained and gives a recovery action", async () => {
  const offline = await readFile(
    new URL("../public/offline.html", import.meta.url),
    "utf8",
  );

  assert.match(offline, /You're offline/);
  assert.match(offline, /location\.reload\(\)/);
  assert.doesNotMatch(offline, /<script src=|<link rel="stylesheet"/);
});
