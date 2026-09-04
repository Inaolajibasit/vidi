import { notFound } from "next/navigation";

import { ChallengeExperience } from "@/features/challenges/components/challenge-experience";
import { getChallengeData } from "@/features/challenges/data";
import { featureFlags } from "@/lib/feature-flags";

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  if (!featureFlags.challenges) notFound();
  const challenge = await getChallengeData((await params).code);
  if (!challenge) notFound();
  return <ChallengeExperience challenge={challenge} />;
}
