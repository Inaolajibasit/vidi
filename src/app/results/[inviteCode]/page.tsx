import { redirect } from "next/navigation";

import { VerdictExperience } from "@/features/results/components/verdict-experience";
import { getVerdictData } from "@/features/results/results-data";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  const verdict = await getVerdictData(inviteCode);
  if (!verdict) redirect(`/join/${inviteCode.toUpperCase()}`);
  return <VerdictExperience verdict={verdict} />;
}
