import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  allowedDevOrigins: ["192.168.1.73"],
  serverExternalPackages: [
    "@google-analytics/data",
    "googleapis",
    "google-auth-library",
    "mongodb",
    "bcryptjs",
    "cheerio",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/dashboard/ceo-money", destination: "/dashboard/ceo/money", permanent: true },
      {
        source: "/dashboard/ceo/client-deliverables-overdue",
        destination: "/dashboard/ceo/prs-and-interviews",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
