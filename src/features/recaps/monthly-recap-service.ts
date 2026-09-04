import "server-only";

import { z } from "zod";

import {
  calculateMonthlyRecap,
  getUtcMonthlyRecapPeriod,
  type MonthlyRecap,
  type MonthlyRecapPeriod,
  type MonthlyRecapSource,
} from "@/lib/algorithms/monthly-recap";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const requestSchema = z.object({
  month: z.number().int().min(1).max(12),
  profileId: z.uuid(),
  year: z.number().int().min(2020).max(2200),
});

const namedAttributeSchema = z.object({
  id: z.number().int(),
  name: z.string().trim().min(1),
});

const sourceSchema = z.object({
  attributes: z.array(
    z.object({
      genres: z.array(namedAttributeSchema),
      movieId: z.uuid(),
      themes: z.array(namedAttributeSchema),
    }),
  ),
  compatibilities: z.array(
    z.object({
      completedAt: z.string().min(1),
      friendDisplayName: z.string().trim().min(1),
      friendProfileId: z.uuid(),
      gameId: z.uuid(),
      overallScore: z.number().min(0).max(100),
    }),
  ),
  games: z.array(
    z.object({
      completedAt: z.string().min(1),
      gameId: z.uuid(),
      knowledgeScore: z.number().min(0).max(100),
      personalityId: z.string().trim().min(1).nullable(),
    }),
  ),
  personalityBeforeMonth: z.string().trim().min(1).nullable(),
  ratings: z.array(
    z.object({
      movieId: z.uuid(),
      reaction: z.enum(["loved", "liked", "meh", "cant_remember"]).nullable(),
      recordedAt: z.string().min(1),
      seen: z.boolean(),
      updatedAt: z.string().min(1),
    }),
  ),
  seenBeforeMonth: z.number().int().nonnegative(),
  seenThroughMonth: z.number().int().nonnegative(),
});

export interface MonthlyRecapSnapshot extends MonthlyRecap {
  period: MonthlyRecapPeriod;
  profileId: string;
}

export async function getMonthlyRecap(
  profileId: string,
  year: number,
  month: number,
): Promise<MonthlyRecapSnapshot> {
  const input = requestSchema.parse({ month, profileId, year });
  const period = getUtcMonthlyRecapPeriod(input.year, input.month);
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_monthly_recap_source",
    {
      p_month_end: period.end,
      p_month_start: period.start,
      p_profile_id: input.profileId,
    },
  );
  if (error) throw new Error("Monthly recap query failed.", { cause: error });

  const source: MonthlyRecapSource = sourceSchema.parse(data);
  return {
    ...calculateMonthlyRecap(source),
    period,
    profileId: input.profileId,
  };
}
