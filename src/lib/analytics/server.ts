import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import {
  parseAnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsProperties,
  type ParsedAnalyticsEvent,
} from "@/lib/analytics/events";
import {
  getAnalyticsProvider,
  hashAnalyticsValue,
} from "@/lib/analytics/provider";

export const ANALYTICS_ACTOR_COOKIE = "vidi_aid";
const actorSchema = z.uuid();

async function analyticsActorHash() {
  const store = await cookies();
  const existing = actorSchema.safeParse(
    store.get(ANALYTICS_ACTOR_COOKIE)?.value,
  );
  const actorId = existing.success ? existing.data : randomUUID();
  if (!existing.success) {
    try {
      store.set(ANALYTICS_ACTOR_COOKIE, actorId, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    } catch {
      // Some server-rendering contexts cannot mutate cookies. The event can
      // still be recorded without an actor instead of affecting the product.
      return null;
    }
  }
  return hashAnalyticsValue("actor", actorId);
}

export async function trackParsedServerAnalytics(event: ParsedAnalyticsEvent) {
  try {
    await getAnalyticsProvider().track({
      actorHash: await analyticsActorHash(),
      entityHash: event.entityKey
        ? hashAnalyticsValue("entity", event.entityKey)
        : null,
      name: event.name,
      properties: event.properties,
    });
  } catch (error) {
    // Analytics is strictly best-effort and must never interrupt gameplay.
    console.error("Product analytics event failed", {
      event: event.name,
      reason: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function trackServerAnalytics<Name extends AnalyticsEventName>(
  name: Name,
  properties: AnalyticsProperties<Name>,
  entityKey?: string | null,
) {
  try {
    await trackParsedServerAnalytics(
      parseAnalyticsEvent({
        entityKey: entityKey ?? null,
        name,
        properties,
      }),
    );
  } catch (error) {
    console.error("Product analytics event failed", {
      event: name,
      reason: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
