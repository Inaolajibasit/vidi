export const SHARE_CARD_FORMATS = {
  story: {
    aspectRatio: "9 / 16",
    height: 1920,
    label: "9:16 Story",
    width: 1080,
  },
  portrait: {
    aspectRatio: "4 / 5",
    height: 1350,
    label: "4:5 Post",
    width: 1080,
  },
  square: {
    aspectRatio: "1 / 1",
    height: 1080,
    label: "1:1 Square",
    width: 1080,
  },
} as const;

export type ShareCardFormat = keyof typeof SHARE_CARD_FORMATS;
export const DEFAULT_SHARE_CARD_FORMAT: ShareCardFormat = "story";

export function parseShareCardFormat(value: string | null): ShareCardFormat {
  return value && value in SHARE_CARD_FORMATS
    ? (value as ShareCardFormat)
    : DEFAULT_SHARE_CARD_FORMAT;
}

export function shareCardFilename(inviteCode: string, format: ShareCardFormat) {
  return `vidi-${inviteCode.toLowerCase()}-${format}.png`;
}

export function formatPlayerNames(names: string[]) {
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) =>
      name.length > 18 ? `${name.slice(0, 17).trimEnd()}…` : name,
    )
    .map((name) => name.toLocaleUpperCase("en"))
    .join("  ×  ");
}
