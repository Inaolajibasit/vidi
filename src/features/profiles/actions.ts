"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
const schema = z.object({
  avatarUrl: z.union([
    z.literal(""),
    z
      .url()
      .max(2048)
      .refine((value) => new URL(value).protocol === "https:", {
        message: "Avatar URLs must use HTTPS.",
      }),
  ]),
  displayName: z.string().trim().min(1).max(50),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/),
});
export async function updateProfileAction(formData: FormData) {
  const input = schema.safeParse({
    avatarUrl: formData.get("avatarUrl"),
    displayName: formData.get("displayName"),
    username: formData.get("username"),
  });
  if (!input.success) return;
  const client = await createSupabaseServerClient();
  const { data } = client
    ? await client.auth.getUser()
    : { data: { user: null } };
  if (!client || !data.user) return;
  const { error } = await client
    .from("profiles")
    .update({
      avatar_url: input.data.avatarUrl || null,
      display_name: input.data.displayName,
      username: input.data.username,
    })
    .eq("id", data.user.id);
  if (error) throw error;
  revalidatePath("/profile");
}
