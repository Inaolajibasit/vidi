"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useActionFeedback } from "@/components/ui/action-feedback";

const INSTALL_PROMPT_KEY = "vidi:install-prompt:v1";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function remember(value: "dismissed" | "installed") {
  try {
    localStorage.setItem(INSTALL_PROMPT_KEY, value);
  } catch {
    // Storage can be unavailable in private browsing. Dismissing still hides
    // the prompt for the current page view.
  }
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const installLock = useRef(false);
  const notify = useActionFeedback();
  const dialogRef = useRef<HTMLElement>(null);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pathname !== "/" || isStandalone()) {
      if (isStandalone()) remember("installed");
      return;
    }

    try {
      if (localStorage.getItem(INSTALL_PROMPT_KEY)) return;
    } catch {
      // Continue without persistence when storage is unavailable.
    }

    const userAgent = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(userAgent);
    let iosTimer: number | undefined;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setPlatform("android");
      setVisible(true);
    }

    function handleInstalled() {
      remember("installed");
      setVisible(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if (ios) {
      iosTimer = window.setTimeout(() => {
        setPlatform("ios");
        setVisible(true);
      }, 1_200);
    }

    return () => {
      if (iosTimer) window.clearTimeout(iosTimer);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dismissButtonRef.current?.focus();

    function handleDialogKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyboard);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyboard);
      previousFocus?.focus();
    };
  }, [visible]);

  function dismiss() {
    remember("dismissed");
    setVisible(false);
  }

  async function install() {
    if (!installEvent || installLock.current) return;
    installLock.current = true;
    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      remember(choice.outcome === "accepted" ? "installed" : "dismissed");
      setInstallEvent(null);
      setVisible(false);
      if (choice.outcome === "accepted")
        notify({
          success: true,
          message:
            "Installation accepted. Your device will finish adding vidi.",
        });
    } catch {
      notify({
        success: false,
        message: "Couldn't open installation. Please try again.",
      });
    } finally {
      installLock.current = false;
      setInstalling(false);
    }
  }

  if (!visible || !platform) return null;

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={dismiss}
    >
      <aside
        aria-describedby="install-vidi-description"
        aria-labelledby="install-vidi-title"
        aria-live="polite"
        aria-modal="true"
        className="border-foreground/20 bg-background w-full max-w-sm rounded-lg border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start gap-4">
          <Image
            alt=""
            aria-hidden="true"
            className="size-14 shrink-0 rounded-xl"
            height={56}
            priority
            src="/icon-192.png"
            width={56}
          />
          <div className="min-w-0 flex-1">
            <p className="text-label text-purple">Keep vidi close</p>
            <h2
              className="font-display mt-2 text-2xl leading-none uppercase"
              id="install-vidi-title"
            >
              Add to your home screen.
            </h2>
            <p
              className="text-muted mt-2 text-sm leading-5"
              id="install-vidi-description"
            >
              {platform === "ios"
                ? "In Safari, tap Share, then Add to Home Screen."
                : "Launch vidi like an app, straight from your home screen."}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            className="border-border text-muted min-h-12 rounded-md border px-3 text-xs font-extrabold uppercase transition-transform active:scale-[0.98]"
            onClick={dismiss}
            ref={dismissButtonRef}
            type="button"
          >
            Not now
          </button>
          {platform === "android" ? (
            <Button
              className="bg-accent text-background min-h-12 rounded-md px-3 text-xs font-extrabold uppercase transition-transform active:scale-[0.98]"
              onClick={() => void install()}
              loading={installing}
              loadingLabel="Opening install…"
              type="button"
            >
              Install
            </Button>
          ) : (
            <button
              className="bg-accent text-background min-h-12 rounded-md px-3 text-xs font-extrabold uppercase transition-transform active:scale-[0.98]"
              onClick={dismiss}
              type="button"
            >
              Got it
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
