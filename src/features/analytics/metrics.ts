import "server-only";

import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const rateSchema = z.object({
  denominator: z.number().int().nonnegative(),
  numerator: z.number().int().nonnegative(),
  rate: z.number().min(0).nullable(),
});

const metricsSchema = z.object({
  averageDeckCompletion: z.number().min(0).max(100).nullable(),
  challengeConversionRate: rateSchema,
  gameCompletionRate: rateSchema,
  guestToAccountConversionRate: rateSchema,
  inviteConversionRate: rateSchema,
  rematchRate: rateSchema,
  shareRate: rateSchema,
});

export type ProductAnalyticsMetrics = z.infer<typeof metricsSchema>;

export async function getProductAnalyticsMetrics(
  periodStart: Date,
  periodEnd: Date,
): Promise<ProductAnalyticsMetrics> {
  if (
    Number.isNaN(periodStart.getTime()) ||
    Number.isNaN(periodEnd.getTime()) ||
    periodEnd <= periodStart
  ) {
    throw new RangeError("Analytics period end must be after its start.");
  }
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_product_analytics_metrics",
    {
      p_period_end: periodEnd.toISOString(),
      p_period_start: periodStart.toISOString(),
    },
  );
  if (error)
    throw new Error("Product analytics metrics query failed.", {
      cause: error,
    });
  return metricsSchema.parse(data);
}
