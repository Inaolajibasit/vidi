import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPlayerNames,
  parseShareCardFormat,
  shareCardFilename,
  SHARE_CARD_FORMATS,
} from "../src/features/results/share-card";

test("share formats use the requested social aspect ratios", () => {
  assert.deepEqual(
    [SHARE_CARD_FORMATS.square.width, SHARE_CARD_FORMATS.square.height],
    [1080, 1080],
  );
  assert.deepEqual(
    [SHARE_CARD_FORMATS.portrait.width, SHARE_CARD_FORMATS.portrait.height],
    [1080, 1350],
  );
  assert.deepEqual(
    [SHARE_CARD_FORMATS.story.width, SHARE_CARD_FORMATS.story.height],
    [1080, 1920],
  );
});

test("story is the safe default for absent or invalid formats", () => {
  assert.equal(parseShareCardFormat(null), "story");
  assert.equal(parseShareCardFormat("wide"), "story");
  assert.equal(parseShareCardFormat("portrait"), "portrait");
});

test("share metadata is normalized consistently", () => {
  assert.equal(formatPlayerNames([" Basit ", "Sarah"]), "BASIT  ×  SARAH");
  assert.equal(shareCardFilename("A1B2C3", "story"), "vidi-a1b2c3-story.png");
  assert.equal(
    formatPlayerNames(["An exceptionally long player name"]),
    "AN EXCEPTIONALLY…",
  );
});
