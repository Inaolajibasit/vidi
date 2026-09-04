import { NextResponse } from "next/server";
import { z } from "zod";

import { parseAnalyticsEvent } from "@/lib/analytics/events";
import { trackParsedServerAnalytics } from "@/lib/analytics/server";

const MAX_BODY_BYTES = 4_096;

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES)
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });

  try {
    const event = parseAnalyticsEvent(await request.json());
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
