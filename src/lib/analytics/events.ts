import { z } from "zod";

const empty = z.object({}).strict();
const gameMode = z.enum(["quick", "proper", "no_life"]);
const gameCreated = z
  .object({
    deckSize: z.number().int().min(1).max(200),
    isGuest: z.boolean(),
    maxPlayers: z.number().int().min(2).max(5),
    mode: gameMode,
  })
  .strict();

export const ANALYTICS_PROPERTY_SCHEMAS = {
  challenge_completed: empty,
  challenge_created: empty,
  challenge_opened: empty,
  create_game_clicked: empty,
  friend_request_sent: empty,
  game_completed: z
    .object({
      deckSize: z.number().int().min(1).max(200),
      mode: gameMode,
      playerCount: z.number().int().min(2).max(5),
    })
    .strict(),
  game_created: gameCreated,
  game_started: z
    .object({
      deckSize: z.number().int().min(1).max(200),
      mode: gameMode,
      playerCount: z.number().int().min(2).max(5),
    })
    .strict(),
  home_viewed: empty,
  invite_shared: z
    .object({ method: z.enum(["clipboard", "web_share"]) })
    .strict(),
  join_page_opened: empty,
  movie_swiped: z
    .object({
      deckSize: z.number().int().min(1).max(200),
      progress: z.number().int().min(0).max(200),
    })
    .strict(),
  player_joined: z.object({ isGuest: z.boolean() }).strict(),
  result_shared: z
    .object({
      format: z.enum(["story", "portrait", "square"]),
      method: z.enum(["download", "web_share"]),
    })
    .strict(),
  results_viewed: empty,
  signup_completed: z
    .object({
      hadGuestHistory: z.boolean(),
      method: z.enum(["email", "google"]),
    })
    .strict(),
  signup_started: z.object({ method: z.enum(["email", "google"]) }).strict(),
  watchlist_saved: z
    .object({
      itemCount: z.number().int().nonnegative().max(200),
      kind: z.enum(["personal", "shared"]),
    })
    .strict(),
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_PROPERTY_SCHEMAS;
export type AnalyticsProperties<Name extends AnalyticsEventName> = z.infer<
  (typeof ANALYTICS_PROPERTY_SCHEMAS)[Name]
>;

const eventNameSchema = z.enum(
  Object.keys(ANALYTICS_PROPERTY_SCHEMAS) as [
    AnalyticsEventName,
    ...AnalyticsEventName[],
  ],
);
const entityEvents = new Set<AnalyticsEventName>([
  "challenge_completed",
  "challenge_created",
  "challenge_opened",
  "game_completed",
  "game_created",
  "game_started",
  "invite_shared",
  "join_page_opened",
  "movie_swiped",
  "player_joined",
  "result_shared",
  "results_viewed",
]);

export interface ParsedAnalyticsEvent {
  entityKey: string | null;
  name: AnalyticsEventName;
  properties: Record<string, boolean | number | string>;
}

export function parseAnalyticsEvent(input: unknown): ParsedAnalyticsEvent {
  const envelope = z
    .object({
      entityKey: z.string().trim().min(1).max(100).nullable().optional(),
      name: eventNameSchema,
      properties: z.unknown(),
    })
    .strict()
    .parse(input);
  const entityKey = envelope.entityKey ?? null;
  if (entityEvents.has(envelope.name) && !entityKey)
    throw new z.ZodError([
      {
        code: "custom",
        message: "This analytics event requires an entity key.",
        path: ["entityKey"],
      },
    ]);
  const properties = ANALYTICS_PROPERTY_SCHEMAS[envelope.name].parse(
    envelope.properties,
  );
  return {
    entityKey,
    name: envelope.name,
    properties: properties as Record<string, boolean | number | string>,
  };
}
