import "server-only";

import { z } from "zod";

import type { AnalyticsEventName } from "@/lib/analytics/events";
import { hashAnalyticsIdentifier } from "@/lib/analytics/privacy";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface AnalyticsRecord {
  actorHash: string | null;
  entityHash: string | null;
  name: AnalyticsEventName;
  properties: Record<string, boolean | number | string>;
}

export interface AnalyticsProvider {
  track(record: AnalyticsRecord): Promise<void>;
}

const configSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("disabled") }),
  z.object({
    hashSecret: z.string().min(32),
    provider: z.literal("supabase"),
  }),
]);

function analyticsConfig() {
  return configSchema.safeParse(
    process.env.ANALYTICS_PROVIDER === "supabase"
      ? {
          hashSecret: process.env.ANALYTICS_HASH_SECRET,
          provider: "supabase",
        }
      : { provider: "disabled" },
  );
}

class DisabledAnalyticsProvider implements AnalyticsProvider {
  async track() {}
}

class SupabaseAnalyticsProvider implements AnalyticsProvider {
  async track(record: AnalyticsRecord) {
    const { error } = await getSupabaseAdmin().rpc(
      "record_product_analytics_event",
      {
        p_actor_hash: record.actorHash,
        p_entity_hash: record.entityHash,
        p_event_name: record.name,
        p_properties: record.properties,
      },
    );
    if (error) throw error;
  }
}

const disabledProvider = new DisabledAnalyticsProvider();
const supabaseProvider = new SupabaseAnalyticsProvider();

export function getAnalyticsProvider(): AnalyticsProvider {
  const config = analyticsConfig();
  return config.success && config.data.provider === "supabase"
    ? supabaseProvider
    : disabledProvider;
}

export function hashAnalyticsValue(
  namespace: "actor" | "entity",
  value: string,
) {
  const config = analyticsConfig();
  if (!config.success || config.data.provider !== "supabase") return null;
  return hashAnalyticsIdentifier(config.data.hashSecret, namespace, value);
}
