import { z } from "zod";

export const GAME_MODE_DETAILS = {
  no_life: { duration: "~15 min", movieCount: 200, title: "No Life" },
  proper: { duration: "~7 min", movieCount: 100, title: "Proper" },
  quick: { duration: "~2 min", movieCount: 30, title: "Quick" },
} as const;

export const createGameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(50, "Keep your name under 50 characters."),
  maxPlayers: z.coerce
    .number()
    .int()
    .min(2, "Choose at least 2 players.")
    .max(5, "A vidi game supports up to 5 players."),
  genreIds: z
    .array(z.coerce.number().int().positive())
    .max(6, "Choose up to 6 genres.")
    .default([]),
  mode: z.enum(["quick", "proper", "no_life"], {
    message: "Choose a game length.",
  }),
});

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Enter a valid 6-character invite code.");

export const joinGameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(50, "Keep your name under 50 characters."),
  inviteCode: inviteCodeSchema,
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
