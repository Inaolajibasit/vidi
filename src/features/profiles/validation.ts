import { z } from "zod";

export const profileSchema = z.object({
  avatarUrl: z.union([
    z.literal(""),
    z
      .url({ error: "Enter a valid image URL." })
      .max(2048)
      .refine(
        (value) => URL.canParse(value) && new URL(value).protocol === "https:",
        {
          message: "Use an HTTPS image URL.",
        },
      ),
  ]),
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your display name.")
    .max(50, "Use 50 characters or fewer."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 letters, numbers, or underscores."),
});

export interface ProfileActionState {
  success?: boolean;
  message?: string;
  fieldErrors?: Partial<
    Record<"avatarUrl" | "displayName" | "username", string[]>
  >;
}
