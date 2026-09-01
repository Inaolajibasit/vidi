"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { claimGuestHistory } from "@/features/auth/actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

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
    const { error } = await client.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.data,
      type: "email",
    });
    if (error) {
      setBusy(false);
      return setMessage(error.message);
    }
    await claimGuestHistory();
    router.replace(next);
    router.refresh();
  }
  return (
    <div className="grid gap-4">
      <button
        className="border-border min-h-14 rounded-md border font-bold"
        disabled={busy}
        onClick={google}
      >
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
            className="border-border bg-surface min-h-14 rounded-md border px-4 text-center text-xl tracking-[.35em]"
            inputMode="numeric"
            maxLength={6}
            id="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          />
        ) : (
          <input
            autoComplete="email"
            className="border-border bg-surface min-h-14 rounded-md border px-4"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <button
          className="bg-accent text-background min-h-14 rounded-md font-extrabold uppercase"
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
