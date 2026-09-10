import assert from "node:assert/strict";
import test from "node:test";
import { profileSchema } from "../src/features/profiles/validation";

const valid = { displayName: "Sam", username: "sam_movies", avatarUrl: "" };
test("profile fields normalize names and allow clearing the custom avatar", () => {
  assert.deepEqual(
    profileSchema.parse({
      ...valid,
      displayName: " Sam ",
      username: " SAM_MOVIES ",
    }),
    valid,
  );
});
test("profile rejects blank names and identifies the field to correct", () => {
  const result = profileSchema.safeParse({ ...valid, displayName: "   " });
  assert.equal(result.success, false);
  if (!result.success)
    assert.ok(result.error.flatten().fieldErrors.displayName?.length);
});
test("profile rejects unsafe avatar URLs and invalid usernames", () => {
  for (const avatarUrl of [
    "http://example.com/image.png",
    "javascript:alert(1)",
    "not a URL",
  ]) {
    assert.equal(
      profileSchema.safeParse({ ...valid, avatarUrl }).success,
      false,
    );
  }
  for (const username of ["ab", "has spaces", "a".repeat(25)]) {
    assert.equal(
      profileSchema.safeParse({ ...valid, username }).success,
      false,
    );
  }
});
