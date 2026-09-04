import { readFile } from "node:fs/promises";

import { ImageResponse } from "next/og";

import {
  formatPlayerNames,
  parseShareCardFormat,
  SHARE_CARD_FORMATS,
} from "@/features/results/share-card";
import { getShareCardData } from "@/features/results/share-card-data";

export const runtime = "nodejs";

const FONT_URLS = {
  ericaOne: new URL(
    "../../../../../../node_modules/@fontsource/erica-one/files/erica-one-latin-400-normal.woff",
    import.meta.url,
  ),
  fascinate: new URL(
    "../../../../../../node_modules/@fontsource/fascinate/files/fascinate-latin-400-normal.woff",
    import.meta.url,
  ),
  geist: new URL(
    "../../../../../../node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
    import.meta.url,
  ),
  geistBold: new URL(
    "../../../../../../node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf",
    import.meta.url,
  ),
} as const;

async function loadFont(url: URL) {
  const buffer = await readFile(url);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function Stat({
  background,
  color,
  label,
  value,
}: {
  background: string;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background,
        color,
        display: "flex",
        flex: 1,
        flexDirection: "column",
        justifyContent: "space-between",
        minWidth: 0,
        padding: "30px 28px",
      }}
    >
      <span
        style={{
          fontFamily: "Geist",
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "Erica One",
          fontSize: 68,
          letterSpacing: "-0.04em",
          lineHeight: 0.82,
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

  const [ericaOne, fascinate, geist, geistBold] = await Promise.all([
    loadFont(FONT_URLS.ericaOne),
    loadFont(FONT_URLS.fascinate),
    loadFont(FONT_URLS.geist),
    loadFont(FONT_URLS.geistBold),
  ]);
  const format = parseShareCardFormat(
    new URL(request.url).searchParams.get("format"),
  );
  const dimensions = SHARE_CARD_FORMATS[format];
  const square = format === "square";
  const story = format === "story";
  const playerNames = formatPlayerNames(data.playerNames);
  const disagreement = data.biggestDisagreement
    ? data.biggestDisagreement.length > 58
      ? `${data.biggestDisagreement.slice(0, 57).trimEnd()}…`
      : data.biggestDisagreement
    : "No drama. Somehow.";
  const playerNameSize = Math.max(
    20,
    (square ? 29 : 33) - Math.max(0, playerNames.length - 30) * 0.16,
  );

  return new ImageResponse(
    <div
      style={{
        background: "#090909",
        color: "#F1EFE7",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Geist",
        height: "100%",
        overflow: "hidden",
        padding: square ? 54 : 64,
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#2227F7",
          borderRadius: 999,
          display: "flex",
          height: story ? 420 : 300,
          left: -170,
          position: "absolute",
          top: story ? 480 : 330,
          width: story ? 420 : 300,
        }}
      />
      <div
        style={{
          border: "18px solid #F1EFE7",
          borderRadius: 999,
          display: "flex",
          height: 210,
          position: "absolute",
          right: -75,
          top: story ? 1040 : 700,
          width: 210,
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
            fontFamily: "Fascinate",
            fontSize: 51,
            lineHeight: 1,
          }}
        >
          vidi<span style={{ color: "#2227F7" }}>.</span>
        </span>
        <span
          style={{
            color: "#A3A3A3",
            fontFamily: "Geist",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.15em",
          }}
        >
          THE VERDICT /{" "}
          {format === "story"
            ? "09:16"
            : format === "portrait"
              ? "04:05"
              : "01:01"}
        </span>
      </div>

      <div
        style={{
          color: "#FFD628",
          display: "flex",
          fontFamily: "Geist",
          fontSize: playerNameSize,
          fontWeight: 700,
          letterSpacing: "0.075em",
          lineHeight: 1.15,
          marginTop: story ? 116 : 62,
          maxWidth: 900,
          position: "relative",
          textTransform: "uppercase",
        }}
      >
        {playerNames}
      </div>

      <div
        style={{
          background: "#FFD628",
          borderRadius: "0 86px 0 0",
          color: "#090909",
          display: "flex",
          flexDirection: "column",
          height: square ? 344 : story ? 610 : 455,
          justifyContent: "center",
          marginTop: square ? 38 : 50,
          overflow: "hidden",
          padding: square ? "38px 48px" : "50px 58px",
          position: "relative",
        }}
      >
        <div
          style={{
            background: "#090909",
            borderRadius: 999,
            display: "flex",
            height: square ? 155 : 205,
            position: "absolute",
            right: square ? -40 : -54,
            top: square ? -45 : -62,
            width: square ? 155 : 205,
          }}
        />
        <div
          style={{
            background: "#2227F7",
            display: "flex",
            height: story ? 220 : 150,
            position: "absolute",
            right: story ? 100 : 70,
            top: -40,
            transform: "rotate(45deg)",
            width: story ? 46 : 34,
          }}
        />
        <div style={{ alignItems: "flex-end", display: "flex" }}>
          <span
            style={{
              fontFamily: "Erica One",
              fontSize: square ? 235 : story ? 330 : 275,
              letterSpacing: "-0.07em",
              lineHeight: 0.68,
            }}
          >
            {data.compatibilityScore}
          </span>
          <span
            style={{
              fontFamily: "Erica One",
              fontSize: square ? 66 : 88,
              lineHeight: 0.7,
              marginLeft: 12,
            }}
          >
            %
          </span>
        </div>
        <span
          style={{
            fontFamily: "Erica One",
            fontSize: square ? 45 : 57,
            lineHeight: 0.9,
            marginTop: square ? 30 : 46,
            textTransform: "uppercase",
          }}
        >
          Movie match
        </span>
      </div>

      <div
        style={{
          display: "flex",
          height: square ? 168 : story ? 260 : 205,
          marginTop: 18,
          position: "relative",
        }}
      >
        <Stat
          background="#2227F7"
          color="#F1EFE7"
          label="Taste"
          value={`${data.tasteScore}%`}
        />
        <Stat
          background="#CBC7FF"
          color="#17122B"
          label="Knowledge"
          value={`${data.knowledgeScore}%`}
        />
        <Stat
          background="#F1EFE7"
          color="#090909"
          label="Shared"
          value={`${data.sharedFavouritesCount}`}
        />
      </div>

      <div
        style={{
          alignItems: "flex-end",
          background: "#17122B",
          borderRadius: "70px 0 0 0",
          display: "flex",
          flex: story ? 1 : undefined,
          justifyContent: "space-between",
          marginTop: 18,
          minHeight: square ? 150 : story ? 285 : 190,
          padding: square ? "26px 34px" : "38px 44px",
          position: "relative",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", maxWidth: 690 }}
        >
          <span
            style={{
              color: "#CBC7FF",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Biggest disagreement
          </span>
          <span
            style={{
              fontFamily: "Erica One",
              fontSize: square ? 37 : story ? 55 : 45,
              lineHeight: 0.92,
              marginTop: 18,
              textTransform: "uppercase",
            }}
          >
            {disagreement}
          </span>
        </div>
        <span
          style={{
            color: "#FFD628",
            fontFamily: "Geist",
            fontSize: square ? 70 : 98,
            fontWeight: 700,
            lineHeight: 0.6,
          }}
        >
          ↘
        </span>
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          marginTop: square ? 25 : 38,
          position: "relative",
        }}
      >
        <span
          style={{
            color: "#FFD628",
            fontFamily: "Fascinate",
            fontSize: square ? 26 : 32,
          }}
        >
          seen it? prove it.
        </span>
        <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
          <div
            style={{
              background: "#2227F7",
              display: "flex",
              height: 14,
              width: 14,
            }}
          />
          <div
            style={{
              background: "#FFD628",
              display: "flex",
              height: 14,
              width: 82,
            }}
          />
        </div>
      </div>
    </div>,
    {
      fonts: [
        { data: ericaOne, name: "Erica One", style: "normal", weight: 400 },
        { data: fascinate, name: "Fascinate", style: "normal", weight: 400 },
        { data: geist, name: "Geist", style: "normal", weight: 400 },
        { data: geistBold, name: "Geist", style: "normal", weight: 700 },
      ],
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
