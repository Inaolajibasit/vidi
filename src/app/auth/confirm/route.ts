import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { claimGuestHistory } from "@/features/auth/actions";
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

  const { error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType,
  });
  if (error) {
    return NextResponse.redirect(new URL("/auth?error=expired_link", url));
  }

  await claimGuestHistory();
  return NextResponse.redirect(new URL(next, url));
}
