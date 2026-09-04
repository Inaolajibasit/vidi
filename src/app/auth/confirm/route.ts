import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { claimGuestHistoryForUser } from "@/features/auth/claim-guest-history";
import { isNewAuthUser } from "@/features/auth/is-new-user";
import { trackServerAnalytics } from "@/lib/analytics/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedTypes = new Set<EmailOtpType>([
  "email",
  "magiclink",
  "recovery",
  "signup",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type") as EmailOtpType | null;
  const rawNext = url.searchParams.get("next");
  const next = rawNext?.startsWith("/") ? rawNext : "/profile";
  const client = await createSupabaseServerClient();

  if (!client || !tokenHash || !rawType || !allowedTypes.has(rawType)) {
    return NextResponse.redirect(new URL("/auth?error=invalid_link", url));
  }

  const { data, error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType,
  });
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/auth?error=expired_link", url));
  }

  const claim = await claimGuestHistoryForUser(data.user.id);
  if (isNewAuthUser(data.user)) {
    await trackServerAnalytics("signup_completed", {
      hadGuestHistory: claim.status === "claimed",
      method: "email",
    });
  }
  return NextResponse.redirect(new URL(next, url));
}
