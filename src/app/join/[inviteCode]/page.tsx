import { notFound, redirect } from "next/navigation";

import { LobbyExperience } from "@/features/games/components/lobby-experience";
import { getLobbyData } from "@/features/games/lobby-data";

interface LobbyPageProps {
  params: Promise<{ inviteCode: string }>;
}

export default async function LobbyPage({ params }: LobbyPageProps) {
  const { inviteCode } = await params;
  const lobby = await getLobbyData(inviteCode);

  if (!lobby) notFound();
  if (lobby.isParticipant && lobby.status === "active") {
    redirect(`/play/${lobby.inviteCode}`);
  }
  if (lobby.isParticipant && lobby.status === "completed") {
    redirect(`/results/${lobby.inviteCode}`);
  }

  return <LobbyExperience lobby={lobby} />;
}
