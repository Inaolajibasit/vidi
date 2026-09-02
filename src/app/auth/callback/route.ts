import { NextResponse } from "next/server";
import { claimGuestHistoryForUser } from "@/features/auth/claim-guest-history";
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

  await claimGuestHistoryForUser(data.user.id);
  return NextResponse.redirect(new URL(next, url));
}
