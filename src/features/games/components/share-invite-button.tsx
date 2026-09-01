"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function InviteActions({ inviteCode }: { inviteCode: string }) {
  const [copyLabel, setCopyLabel] = useState("Copy link");
  const [shareLabel, setShareLabel] = useState("Share");

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
    window.setTimeout(() => setCopyLabel("Copy link"), 2_000);
  }

  async function shareInvite() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          text: `Join my vidi game. Code: ${inviteCode}`,
          title: "Join my vidi game",
          url,
        });
        return;
      }

      await copyInvite();
      setShareLabel("Link copied");
      window.setTimeout(() => setShareLabel("Share"), 2_000);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareLabel("Couldn’t share");
      window.setTimeout(() => setShareLabel("Share"), 2_000);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        leadingIcon={<Icon name="copy" size={18} />}
        onClick={copyInvite}
        size="lg"
        variant="outline"
      >
        {copyLabel}
      </Button>
      <Button
        leadingIcon={<Icon name="share" size={18} />}
        onClick={shareInvite}
        size="lg"
      >
        {shareLabel}
      </Button>
    </div>
  );
}
