"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { claimGuestHistory } from "@/features/auth/actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { trackAnalytics } from "@/lib/analytics/client";
import { isNewAuthUser } from "@/features/auth/is-new-user";

const emailSchema = z.email();
const otpSchema = z.string().regex(/^\d{6}$/);
export function AuthForm({ next = "/profile" }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const client = getSupabaseBrowserClient();
  async function google() {
    if (!client) return setMessage("Authentication is not configured.");
    setBusy(true);
    trackAnalytics("signup_started", { method: "google" });
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email.trim().toLowerCase());
    if (!parsed.success) return setMessage("Enter a valid email address.");
    if (!client) return setMessage("Authentication is not configured.");
    setBusy(true);
    trackAnalytics("signup_started", { method: "email" });
    const { error } = await client.auth.signInWithOtp({
      email: parsed.data,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setSent(true);
    setMessage("Check your email for the link or 6-digit code.");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const code = otpSchema.safeParse(otp.trim());
    if (!code.success) return setMessage("Enter the 6-digit code.");
    if (!client) return;
    setBusy(true);
    const { data, error } = await client.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.data,
      type: "email",
    });
    if (error) {
      setBusy(false);
      return setMessage(error.message);
    }
    const claim = await claimGuestHistory();
    if (data.user && isNewAuthUser(data.user)) {
      trackAnalytics("signup_completed", {
        hadGuestHistory: claim.status === "claimed",
        method: "email",
      });
    }
    router.replace(next);
    router.refresh();
  }
  return (
    <div className="grid gap-4">
      <button
        className="border-foreground/50 hover:bg-foreground hover:text-background flex min-h-14 items-center justify-center gap-3 rounded-sm border font-extrabold uppercase transition-[color,background-color,transform] duration-150 active:scale-[0.97]"
        disabled={busy}
        onClick={google}
      >
        <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 24 24">
          <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.6Z" fill="#4285F4" />
          <path d="M12 22c2.7 0 5-.9 6.8-2.4L15.5 17a6.2 6.2 0 0 1-9.3-3.3H2.8v2.7A10.3 10.3 0 0 0 12 22Z" fill="#34A853" />
          <path d="M6.2 13.7a6.2 6.2 0 0 1 0-3.9V7.1H2.8a10.2 10.2 0 0 0 0 9.3l3.4-2.7Z" fill="#FBBC05" />
          <path d="M12 5.8c1.6 0 3 .5 4.1 1.6l3.1-3.1A10.2 10.2 0 0 0 2.8 7.1l3.4 2.7A6.1 6.1 0 0 1 12 5.8Z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>
      <div className="text-muted flex items-center gap-3 text-xs">
        <span className="border-border flex-1 border-t" />
        OR
        <span className="border-border flex-1 border-t" />
      </div>
      <form className="grid gap-3" onSubmit={sent ? verify : send}>
        <label className="text-label" htmlFor={sent ? "otp" : "email"}>
          {sent ? "One-time code" : "Email address"}
        </label>
        {sent ? (
          <input
            autoComplete="one-time-code"
            className="border-border bg-background/80 focus:border-accent min-h-14 rounded-sm border px-4 text-center text-xl tracking-[.35em] outline-none"
            inputMode="numeric"
            maxLength={6}
            id="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          />
        ) : (
          <input
            autoComplete="email"
            className="border-border bg-background/80 focus:border-accent min-h-14 rounded-sm border px-4 outline-none"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <button
          className="bg-accent text-background min-h-14 rounded-sm font-extrabold uppercase transition-[transform,box-shadow] duration-150 hover:shadow-[4px_4px_0_#2227F7] active:scale-[0.97] active:shadow-none"
          disabled={busy}
        >
          {busy
            ? "Please wait…"
            : sent
              ? "Verify code"
              : "Email me a sign-in link"}
        </button>
      </form>
      {sent ? (
        <button
          className="text-muted min-h-11 text-sm underline"
          onClick={() => {
            setSent(false);
            setOtp("");
            setMessage("");
          }}
        >
          Use a different email
        </button>
      ) : null}
      <p aria-live="polite" className="text-muted min-h-6 text-center text-sm">
        {message}
      </p>
    </div>
  );
}
