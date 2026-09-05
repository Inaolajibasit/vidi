"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const kindSchema = z.enum(["friend_request", "game"]);
const entityIdsSchema = z.array(z.uuid()).max(100);

export type AccountAttentionKind = z.infer<typeof kindSchema>;

export async function markAccountAttentionSeen(
  rawKind: AccountAttentionKind,
  rawEntityIds: string[],
) {
  const kind = kindSchema.safeParse(rawKind);
  const entityIds = entityIdsSchema.safeParse(rawEntityIds);
  if (!kind.success || !entityIds.success || !entityIds.data.length) {
    return false;
  }

  const client = await createSupabaseServerClient();
  if (!client) return false;
  const { data: authData } = await client.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return false;

  const requestedIds = [...new Set(entityIds.data)];
  const { data: ownedEntities, error: ownedError } =
    kind.data === "game"
      ? await client
          .from("game_players")
          .select("game_id")
          .eq("profile_id", userId)
          .in("game_id", requestedIds)
      : await client
          .from("friendships")
          .select("id")
          .eq("addressee_id", userId)
          .eq("status", "pending")
          .in("id", requestedIds);
  if (ownedError) return false;

  const verifiedIds = (ownedEntities ?? []).map((item) =>
    "game_id" in item ? item.game_id : item.id,
  );
  if (!verifiedIds.length) return false;

  const { error } = await client.from("account_attention_reads").upsert(
    verifiedIds.map((entityId) => ({
      entity_id: entityId,
      kind: kind.data,
      profile_id: userId,
      seen_at: new Date().toISOString(),
    })),
    { onConflict: "profile_id,kind,entity_id" },
  );
  if (error) return false;

  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath("/profile");
  return true;
}
