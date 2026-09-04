import { ImageResponse } from "next/og";

import {
  formatPlayerNames,
  parseShareCardFormat,
  SHARE_CARD_FORMATS,
} from "@/features/results/share-card";
import { getShareCardData } from "@/features/results/share-card-data";

export const runtime = "nodejs";

function Stat({
  accent = false,
  label,
  value,
}: {
  accent?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span
        style={{
          color: "#A3A3A3",
          fontSize: 25,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: accent ? "#FFD628" : "#F1EFE7",
          fontSize: 76,
          fontWeight: 900,
          letterSpacing: "-0.055em",
          lineHeight: 0.9,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await params;
  const data = await getShareCardData(inviteCode);
  if (!data) {
    return Response.json(
      { error: "This completed result is not available." },
      { status: 404 },
    );
  }

  const format = parseShareCardFormat(
    new URL(request.url).searchParams.get("format"),
  );
  const dimensions = SHARE_CARD_FORMATS[format];
  const compact = format === "square";
  const story = format === "story";
  const playerNames = formatPlayerNames(data.playerNames);
  const playerNameSize = Math.max(
    compact ? 20 : 22,
    (compact ? 31 : 35) - Math.max(0, playerNames.length - 30) * 0.18,
  );

  return new ImageResponse(
    <div
      style={{
        background: "#090909",
        color: "#F1EFE7",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        height: "100%",
        overflow: "hidden",
        padding: compact ? "62px 68px" : "78px 76px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#2227F7",
          display: "flex",
          height: story ? 540 : 340,
          position: "absolute",
          right: -230,
          top: story ? 310 : 210,
          transform: "rotate(-9deg)",
          width: 760,
        }}
      />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        <span
          style={{
            color: "#FFD628",
            fontSize: 50,
            fontWeight: 900,
            letterSpacing: "-0.06em",
          }}
        >
          vidi<span style={{ color: "#2227F7" }}>.</span>
        </span>
        <span
          style={{
            color: "#A3A3A3",
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: "0.18em",
          }}
        >
          THE VERDICT
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: story ? 185 : 86,
          position: "relative",
        }}
      >
        <span
          style={{
            fontSize: playerNameSize,
            fontWeight: 800,
            letterSpacing: "0.08em",
            lineHeight: 1.15,
            maxWidth: 900,
            textTransform: "uppercase",
          }}
        >
          {playerNames}
        </span>
        <div
          style={{
            alignItems: "flex-end",
            display: "flex",
            marginTop: compact ? 38 : 66,
          }}
        >
          <span
            style={{
              color: "#FFD628",
              fontSize: compact ? 245 : story ? 320 : 280,
              fontWeight: 900,
              letterSpacing: "-0.095em",
              lineHeight: 0.72,
            }}
          >
            {data.compatibilityScore}
          </span>
          <span
            style={{
              color: "#FFD628",
              fontSize: compact ? 76 : 94,
              fontWeight: 900,
              lineHeight: 0.72,
              marginLeft: 12,
            }}
          >
            %
          </span>
        </div>
        <span
          style={{
            fontSize: compact ? 49 : 62,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            marginTop: 34,
            textTransform: "uppercase",
          }}
        >
          Movie match
        </span>
      </div>

      <div
        style={{
          borderBottom: "2px solid #292929",
          borderTop: "2px solid #292929",
          display: "flex",
          gap: 100,
          marginTop: story ? 150 : 80,
          padding: compact ? "34px 0" : "52px 0",
          position: "relative",
        }}
      >
        <Stat accent label="Taste" value={`${data.tasteScore}%`} />
        <Stat label="Knowledge" value={`${data.knowledgeScore}%`} />
        <Stat
          label="Shared favourites"
          value={`${data.sharedFavouritesCount}`}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: story ? 105 : 54,
          position: "relative",
        }}
      >
        <span
          style={{
            color: "#A3A3A3",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Biggest disagreement
        </span>
        <span
          style={{
            fontSize: compact ? 48 : 66,
            fontWeight: 900,
            letterSpacing: "-0.045em",
            lineHeight: 0.95,
            marginTop: 24,
            maxWidth: 860,
            textTransform: "uppercase",
          }}
        >
          {data.biggestDisagreement ?? "No drama. Somehow."}
        </span>
      </div>

      <div
        style={{
          alignItems: "flex-end",
          display: "flex",
          justifyContent: "space-between",
          marginTop: "auto",
          position: "relative",
        }}
      >
        <span
          style={{
            color: "#FFD628",
            fontSize: 33,
            fontWeight: 900,
            letterSpacing: "-0.025em",
          }}
        >
          seen it? prove it.
        </span>
        <div
          style={{
            background: "#FFD628",
            display: "flex",
            height: 18,
            width: 130,
          }}
        />
      </div>
    </div>,
    {
      height: dimensions.height,
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
        "Content-Disposition": `inline; filename="vidi-${data.inviteCode.toLowerCase()}-${format}.png"`,
      },
      width: dimensions.width,
    },
  );
}
