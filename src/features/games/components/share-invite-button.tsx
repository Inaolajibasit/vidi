"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { trackAnalytics } from "@/lib/analytics/client";
import { useFeedbackAction } from "@/lib/hooks/use-feedback-action";

export function InviteActions({ inviteCode }: { inviteCode: string }) {
  const { pending, run } = useFeedbackAction();
  async function copy() {
    await navigator.clipboard.writeText(window.location.href);
    trackAnalytics("invite_shared", { method: "clipboard" }, inviteCode);
    return "Invite link copied.";
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        leadingIcon={<Icon name="copy" size={18} />}
        loading={pending === "copy"}
        disabled={Boolean(pending)}
        loadingLabel="Copying…"
        onClick={() =>
          run(
            "copy",
            copy,
            "Couldn't copy the link. Try again or copy the address from your browser.",
          )
        }
        size="lg"
        variant="outline"
      >
        Copy link
      </Button>
      <Button
        leadingIcon={<Icon name="share" size={18} />}
        loading={pending === "share"}
        disabled={Boolean(pending)}
        loadingLabel="Opening share…"
        onClick={() =>
          run(
            "share",
            async () => {
              if (!navigator.share) return copy();
              await navigator.share({
                text: `Join my vidi game. Code: ${inviteCode}`,
                title: "Join my vidi game",
                url: window.location.href,
              });
              trackAnalytics(
                "invite_shared",
                { method: "web_share" },
                inviteCode,
              );
              return "Invite shared.";
            },
            "Couldn't share the invite. Please try again.",
          )
        }
        size="lg"
      >
        Share
      </Button>
    </div>
  );
}
