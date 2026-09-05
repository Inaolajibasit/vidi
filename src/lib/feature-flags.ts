import "server-only";

export const featureFlags = {
  challenges: process.env.ENABLE_CHALLENGES === "true",
  defaultLikeOnSwipe: process.env.ENABLE_DEFAULT_LIKE_ON_SWIPE === "true",
} as const;
