"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_SHARE_CARD_FORMAT,
  shareCardFilename,
  SHARE_CARD_FORMATS,
  type ShareCardFormat,
} from "@/features/results/share-card";
import { cn } from "@/lib/utils";

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M12 16V3m0 0L7 8m5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = url;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

type ShareStatus = "downloaded" | "error" | "idle" | "loading" | "shared";

export function ShareResultCard({ inviteCode }: { inviteCode: string }) {
  const [format, setFormat] = useState<ShareCardFormat>(
    DEFAULT_SHARE_CARD_FORMAT,
  );
  const [status, setStatus] = useState<ShareStatus>("idle");

  async function shareResult() {
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/results/${encodeURIComponent(inviteCode)}/share?format=${format}`,
      );
      if (!response.ok) throw new Error("Image generation failed");

      const blob = await response.blob();
      const filename = shareCardFilename(inviteCode, format);
      const file = new File([blob], filename, { type: "image/png" });
      const shareData = {
        files: [file],
        text: "seen it? prove it.",
        title: "The vidi verdict",
      };

      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setStatus("shared");
        return;
      }

      downloadBlob(blob, filename);
      setStatus("downloaded");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
    }
  }

  const buttonLabel: Record<ShareStatus, string> = {
    downloaded: "Image downloaded",
    error: "Try sharing again",
    idle: "Share result card",
    loading: "Making your card…",
    shared: "Shared",
  };

  return (
    <section
      className="border-border border-y py-6"
      aria-labelledby="share-card-title"
    >
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="text-label text-purple">Share the evidence</p>
          <h2
            className="font-display mt-2 text-3xl font-black uppercase"
            id="share-card-title"
          >
            Pick a format
          </h2>
        </div>
        <span className="text-muted max-w-28 text-right text-xs leading-snug">
          9:16 works best for Stories
        </span>
      </div>

      <div
        className="mt-5 grid grid-cols-3 gap-2"
        role="group"
        aria-label="Result image format"
      >
        {(
          Object.entries(SHARE_CARD_FORMATS) as Array<
            [ShareCardFormat, (typeof SHARE_CARD_FORMATS)[ShareCardFormat]]
          >
        ).map(([value, option]) => (
          <button
            aria-pressed={format === value}
            className={cn(
              "min-h-12 rounded-sm border px-2 text-[0.68rem] font-extrabold tracking-[0.05em] uppercase transition duration-150 active:scale-[0.97]",
              format === value
                ? "border-accent bg-accent text-background"
                : "border-border text-muted hover:border-foreground/40 hover:text-foreground",
            )}
            key={value}
            onClick={() => {
              setFormat(value);
              setStatus("idle");
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <Button
        className="mt-3"
        disabled={status === "loading"}
        fullWidth
        leadingIcon={<ShareIcon />}
        onClick={shareResult}
        size="lg"
        variant="purple"
      >
        {buttonLabel[status]}
      </Button>
      <p className="text-muted mt-3 text-center text-xs" aria-live="polite">
        {status === "error"
          ? "The card could not be generated. Check your connection and try again."
          : "If image sharing is unavailable, the PNG downloads automatically."}
      </p>
    </section>
  );
}
