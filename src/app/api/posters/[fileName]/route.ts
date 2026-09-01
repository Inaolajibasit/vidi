import { type NextRequest, NextResponse } from "next/server";

const POSTER_FILE_PATTERN = /^[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;
const CACHE_SECONDS = 60 * 60 * 24 * 30;

interface PosterRouteContext {
  params: Promise<{ fileName: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: PosterRouteContext,
) {
  const { fileName } = await params;

  if (!POSTER_FILE_PATTERN.test(fileName)) {
    return NextResponse.json({ error: "Invalid poster path." }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://image.tmdb.org/t/p/w780/${encodeURIComponent(fileName)}`,
      { next: { revalidate: CACHE_SECONDS } },
    );

    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "Poster unavailable." }, { status: 404 });
    }

    return new NextResponse(response.body, {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
        "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Poster proxy failed", { error, fileName });
    return NextResponse.json({ error: "Poster unavailable." }, { status: 502 });
  }
}
