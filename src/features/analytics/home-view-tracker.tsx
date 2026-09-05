"use client";

import { useEffect } from "react";

import { trackAnalyticsOnce } from "@/lib/analytics/client";

export function HomeViewTracker() {
  useEffect(() => {
    trackAnalyticsOnce("home-viewed", "home_viewed", {});
  }, []);

  return null;
}
