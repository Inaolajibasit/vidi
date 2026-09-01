import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.8.150"],
  images: {
    deviceSizes: [320, 375, 430, 640, 768, 1080],
    formats: ["image/webp"],
    remotePatterns: [
      {
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
        protocol: "https",
      },
    ],
  },
  reactStrictMode: true,
};

export default nextConfig;
