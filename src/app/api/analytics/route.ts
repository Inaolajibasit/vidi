import { NextResponse } from "next/server";
import { z } from "zod";

import { parseAnalyticsEvent } from "@/lib/analytics/events";
import { trackParsedServerAnalytics } from "@/lib/analytics/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const MAX_BODY_BYTES = 4_096;

export async function POST(request: Request) {
  if (!(await consumeRateLimit("analytics", 120, 3_600))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES)
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });

  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES)
      return NextResponse.json(
        { error: "Payload too large." },
        { status: 413 },
      );
    const event = parseAnalyticsEvent(JSON.parse(body));
    await trackParsedServerAnalytics(event);
    return new NextResponse(null, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Invalid analytics event." },
        { status: 400 },
      );
    return new NextResponse(null, { status: 202 });
  }
}
