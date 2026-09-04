import { NextResponse } from "next/server";
import { claimGuestHistoryForUser } from "@/features/auth/claim-guest-history";
import { isNewAuthUser } from "@/features/auth/is-new-user";
import { trackServerAnalytics } from "@/lib/analytics/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next")?.startsWith("/")
    ? url.searchParams.get("next")!
    : "/profile";
  const client = await createSupabaseServerClient();
  if (!client || !code)
    return NextResponse.redirect(new URL("/auth?error=invalid_callback", url));
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data.user)
    return NextResponse.redirect(
      new URL("/auth?error=verification_failed", url),
    );

  const claim = await claimGuestHistoryForUser(data.user.id);
  if (isNewAuthUser(data.user)) {
    await trackServerAnalytics("signup_completed", {
      hadGuestHistory: claim.status === "claimed",
      method: data.user.app_metadata.provider === "google" ? "google" : "email",
    });
  }
  return NextResponse.redirect(new URL(next, url));
}
