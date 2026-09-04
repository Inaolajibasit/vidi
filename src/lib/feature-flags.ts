import "server-only";

export const featureFlags = {
  challenges: process.env.ENABLE_CHALLENGES === "true",
} as const;
