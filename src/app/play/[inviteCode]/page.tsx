import { redirect } from "next/navigation";

import { StatusAction, StatusScreen } from "@/components/ui/status-state";
import { SwipeGame } from "@/features/games/components/swipe-game";
import { getGameplayData } from "@/features/games/gameplay-data";
import { getLobbyData } from "@/features/games/lobby-data";
import { featureFlags } from "@/lib/feature-flags";

interface PlayPageProps {
  params: Promise<{ inviteCode: string }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { inviteCode } = await params;
  const game = await getGameplayData(inviteCode);

  if (!game) {
    const lobby = await getLobbyData(inviteCode);
    if (lobby) {
      return (
        <StatusScreen
          action={
            lobby.status === "waiting" ? (
              <StatusAction href={`/join/${lobby.inviteCode}`}>
                Return to lobby
              </StatusAction>
            ) : (
              <StatusAction href="/games/new">Create a game</StatusAction>
            )
          }
          description={
            lobby.status === "waiting"
              ? "This player is no longer in the room. Return to the lobby to join again."
              : "This player no longer has access to this game."
          }
          eyebrow="Player removed"
          title="You're out of this room."
          tone="danger"
        />
      );
    }
    return (
      <StatusScreen
        action={<StatusAction href="/join">Enter another code</StatusAction>}
        description="This game link is invalid or no longer available."
        eyebrow="Game unavailable"
        title="We can't open this game."
        tone="danger"
      />
    );
  }
  if (game.status === "waiting") redirect(`/join/${game.inviteCode}`);
  if (game.status === "completed") redirect(`/results/${game.inviteCode}`);

  return (
    <SwipeGame
      defaultLikeOnSwipe={featureFlags.defaultLikeOnSwipe}
      game={game}
    />
  );
}
