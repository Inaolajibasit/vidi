"use client";

import type {
  AnalyticsEventName,
  AnalyticsProperties,
} from "@/lib/analytics/events";

export function trackAnalytics<Name extends AnalyticsEventName>(
  name: Name,
  properties: AnalyticsProperties<Name>,
  entityKey?: string,
) {
  void fetch("/api/analytics", {
    body: JSON.stringify({ entityKey: entityKey ?? null, name, properties }),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}

export function trackAnalyticsOnce<Name extends AnalyticsEventName>(
  onceKey: string,
  name: Name,
  properties: AnalyticsProperties<Name>,
  entityKey?: string,
) {
  try {
    const key = `vidi:analytics:${onceKey}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage can be unavailable in privacy modes; recording once more is
    // preferable to breaking the page.
  }
  trackAnalytics(name, properties, entityKey);
}
