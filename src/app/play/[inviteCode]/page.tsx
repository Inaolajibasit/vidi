import { notFound, redirect } from "next/navigation";

import { SwipeGame } from "@/features/games/components/swipe-game";
import { getGameplayData } from "@/features/games/gameplay-data";

interface PlayPageProps {
  params: Promise<{ inviteCode: string }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { inviteCode } = await params;
  const game = await getGameplayData(inviteCode);

  if (!game) notFound();
  if (game.status === "waiting") redirect(`/join/${game.inviteCode}`);
  if (game.status === "completed") redirect(`/results/${game.inviteCode}`);

  return <SwipeGame game={game} />;
}
