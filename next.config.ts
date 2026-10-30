import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Card and brand saves can carry a logo data URL (up to ~1.5 MB); Vercel caps bodies at 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
