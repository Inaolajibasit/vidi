import { createHmac } from "node:crypto";

export function hashAnalyticsIdentifier(
  secret: string,
  namespace: "actor" | "entity",
  value: string,
) {
  if (secret.length < 32)
    throw new RangeError(
      "Analytics hash secrets must be at least 32 characters.",
    );
  return createHmac("sha256", secret)
    .update(`${namespace}:${value}`)
    .digest("hex");
}
