import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack rooted in this app (avoids picking up ~/package-lock.json)
  turbopack: {
    root: process.cwd(),
  },
  images: {
    qualities: [75, 90],
  },
};

export default nextConfig;
