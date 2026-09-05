import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#090909",
    categories: ["entertainment", "games", "social"],
    description:
      "A fast social movie game for comparing taste and movie knowledge with friends.",
    display: "standalone",
    id: "/",
    icons: [
      {
        purpose: "any",
        sizes: "192x192",
        src: "/icon-192.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "512x512",
        src: "/icon-512.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icon-maskable-512.png",
        type: "image/png",
      },
    ],
    name: "vidi — seen it? prove it.",
    orientation: "portrait-primary",
    scope: "/",
    short_name: "vidi",
    shortcuts: [
      {
        description: "Start a new movie game",
        name: "Create game",
        short_name: "Create",
        url: "/games/new",
      },
      {
        description: "Join a friend's movie game",
        name: "Join game",
        short_name: "Join",
        url: "/join",
      },
    ],
    start_url: "/",
    theme_color: "#090909",
  };
}
