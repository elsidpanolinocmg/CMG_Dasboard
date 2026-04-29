import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  serverExternalPackages: [
    "@google-analytics/data",
    "googleapis",
    "google-auth-library",
    "mongodb",
    "bcryptjs",
    "cheerio",
  ],
};

export default nextConfig;
