import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

import "@fontsource-variable/montserrat";
import "@fontsource/erica-one/latin.css";
import "@fontsource/fascinate/latin.css";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "vidi",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "vidi",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "vidi — seen it? prove it.",
    template: "%s | vidi",
  },
  description:
    "A fast social movie game for comparing taste, knowledge, and favourites with friends.",
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: [
      { sizes: "180x180", type: "image/png", url: "/apple-touch-icon.png" },
    ],
    icon: [
      { sizes: "192x192", type: "image/png", url: "/icon-192.png" },
      { sizes: "512x512", type: "image/png", url: "/icon-512.png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes",
  },
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
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
