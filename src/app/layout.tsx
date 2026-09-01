import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";

import "@fontsource-variable/roboto-condensed";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "vidi — seen it? prove it.",
    template: "%s | vidi",
  },
  description:
    "A fast social movie game for comparing taste, knowledge, and favourites with friends.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#090909",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={GeistSans.variable}
      lang="en"
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
