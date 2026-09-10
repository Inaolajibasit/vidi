"use server";
import { revalidatePath } from "next/cache";
import { profileSchema as schema, type ProfileActionState } from "./validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function updateProfileAction(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const input = schema.safeParse({
    avatarUrl: formData.get("avatarUrl"),
    displayName: formData.get("displayName"),
    username: formData.get("username"),
  });
  if (!input.success)
    return {
      success: false,
      message: "Check the highlighted profile details.",
      fieldErrors: input.error.flatten().fieldErrors,
    };
  try {
    const client = await createSupabaseServerClient();
    const { data } = client
      ? await client.auth.getUser()
      : { data: { user: null } };
    if (!client || !data.user)
      return {
        success: false,
        message: "Your session expired. Sign in again to save your profile.",
      };
    const { data: updated, error } = await client
      .from("profiles")
      .update({
        avatar_url: input.data.avatarUrl || null,
        display_name: input.data.displayName,
        username: input.data.username,
      })
      .eq("id", data.user.id)
      .select("id")
      .maybeSingle();
    if (error?.code === "23505")
      return {
        success: false,
        message: "That username is already taken. Choose another one.",
        fieldErrors: { username: ["This username is already taken."] },
      };
    if (error || !updated)
      return {
        success: false,
        message: "Your profile couldn't be saved. Please try again.",
      };
    revalidatePath("/profile", "layout");
    return { success: true, message: "Profile saved. Your changes are ready." };
  } catch {
    return {
      success: false,
      message:
        "Your profile couldn't be saved. Check your connection and try again.",
    };
  }
}
