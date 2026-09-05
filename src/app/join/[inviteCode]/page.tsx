import { redirect } from "next/navigation";

import { StatusAction, StatusScreen } from "@/components/ui/status-state";
import { LobbyExperience } from "@/features/games/components/lobby-experience";
import { getLobbyData } from "@/features/games/lobby-data";
import { inviteCodeSchema } from "@/features/games/validation";

interface LobbyPageProps {
  params: Promise<{ inviteCode: string }>;
}

export default async function LobbyPage({ params }: LobbyPageProps) {
  const { inviteCode } = await params;
  if (!inviteCodeSchema.safeParse(inviteCode).success) {
    return (
      <StatusScreen
        action={<StatusAction href="/join">Enter another code</StatusAction>}
        description="Invite codes use six letters and numbers. Check the link or enter the code again."
        eyebrow="Invalid invite"
        title="That code isn't right."
        tone="danger"
      />
    );
  }
  const lobby = await getLobbyData(inviteCode);

  if (!lobby) {
    return (
      <StatusScreen
        action={<StatusAction href="/join">Enter another code</StatusAction>}
        description="We couldn't find this room. Ask the host to check the invite or try another code."
        eyebrow="Invalid invite"
        title="Room not found."
        tone="danger"
      />
    );
  }
  if (lobby.isParticipant && lobby.status === "active") {
    redirect(`/play/${lobby.inviteCode}`);
  }
  if (lobby.isParticipant && lobby.status === "completed") {
    redirect(`/results/${lobby.inviteCode}`);
  }

  return <LobbyExperience lobby={lobby} />;
}
