"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_SHARE_CARD_FORMAT,
  shareCardFilename,
  SHARE_CARD_FORMATS,
  type ShareCardFormat,
} from "@/features/results/share-card";
import { cn } from "@/lib/utils";
import { trackAnalytics } from "@/lib/analytics/client";

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

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="22"
      viewBox="0 0 24 24"
      width="22"
    >
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sharingRef = useRef(false);
  const [format, setFormat] = useState<ShareCardFormat>(
    DEFAULT_SHARE_CARD_FORMAT,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ShareStatus>("idle");

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function openDialog() {
    setStatus("idle");
    setIsOpen(true);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }

  function closeDialog() {
    if (sharingRef.current) return;
    dialogRef.current?.close();
  }

  async function shareResult() {
    if (sharingRef.current) return;
    sharingRef.current = true;
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
        trackAnalytics(
          "result_shared",
          { format, method: "web_share" },
          inviteCode,
        );
        setStatus("shared");
        return;
      }

      downloadBlob(blob, filename);
      trackAnalytics(
        "result_shared",
        { format, method: "download" },
        inviteCode,
      );
      setStatus("downloaded");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
    } finally {
      sharingRef.current = false;
    }
  }

  const buttonLabel: Record<ShareStatus, string> = {
    downloaded: "Download started",
    error: "Try sharing again",
    idle: "Share this result",
    loading: "Making your card…",
    shared: "Shared",
  };

  return (
    <>
      <Button
        fullWidth
        leadingIcon={<ShareIcon />}
        onClick={openDialog}
        size="lg"
        variant="purple"
      >
        Share results
      </Button>

      <dialog
        aria-labelledby="share-dialog-title"
        className="border-border bg-surface text-foreground fixed inset-x-0 bottom-0 m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-xl border p-0 backdrop:bg-black/85 backdrop:backdrop-blur-sm sm:inset-0 sm:m-auto sm:max-w-md sm:rounded-xl"
        onCancel={(event) => {
          if (sharingRef.current) event.preventDefault();
          else setIsOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        onClose={() => setIsOpen(false)}
        ref={dialogRef}
      >
        <div className="relative overflow-hidden px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-7 sm:py-7">
          <div
            aria-hidden="true"
            className="bg-purple absolute -top-14 -right-14 size-36 rounded-full"
          />
          <div
            aria-hidden="true"
            className="border-accent absolute top-20 -right-5 size-20 rotate-12 border-[10px]"
          />

          <div className="relative flex items-start justify-between gap-5">
            <div>
              <p className="text-label text-accent">Share the evidence</p>
              <h2
                className="font-display mt-3 text-4xl leading-[0.86] uppercase"
                id="share-dialog-title"
              >
                Pick your
                <br />
                format.
              </h2>
            </div>
            <button
              aria-label="Close share options"
              disabled={status === "loading"}
              className="border-border bg-background/80 relative grid size-11 shrink-0 place-items-center rounded-full border transition active:scale-95"
              onClick={closeDialog}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <div
            className="relative mt-8 grid grid-cols-3 gap-3"
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
                disabled={status === "loading"}
                className={cn(
                  "group flex min-h-36 flex-col items-center justify-end gap-3 rounded-md border p-3 transition duration-150 active:scale-[0.97]",
                  format === value
                    ? "border-accent bg-accent/8 text-foreground"
                    : "border-border text-muted hover:border-foreground/35",
                )}
                key={value}
                onClick={() => {
                  setFormat(value);
                  setStatus("idle");
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative block max-h-20 max-w-14 overflow-hidden border transition",
                    format === value
                      ? "border-accent bg-accent"
                      : "border-muted bg-background",
                  )}
                  style={{ aspectRatio: option.aspectRatio, height: "5rem" }}
                >
                  <span className="bg-purple absolute right-0 bottom-0 h-1/2 w-2/3" />
                  <span className="bg-background absolute top-2 left-2 block size-2 rounded-full" />
                </span>
                <span className="text-center text-[0.65rem] font-extrabold tracking-[0.04em] uppercase">
                  {option.label}
                </span>
              </button>
            ))}
          </div>

          <Button
            className="relative mt-4"
            disabled={status === "loading"}
            loading={status === "loading"}
            loadingLabel="Making your card…"
            fullWidth
            leadingIcon={<ShareIcon />}
            onClick={shareResult}
            size="lg"
          >
            {buttonLabel[status]}
          </Button>
          <p
            className="text-muted relative mt-3 text-center text-xs leading-relaxed"
            aria-live="polite"
          >
            {status === "error"
              ? "The card could not be generated. Check your connection and try again."
              : status === "shared"
                ? "Your result was shared."
                : status === "downloaded"
                  ? "Download started. Look in your device's downloads for the PNG."
                  : "We’ll open your device share menu. If unavailable, the PNG downloads instead."}
          </p>
        </div>
      </dialog>
    </>
  );
}
