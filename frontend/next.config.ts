import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Server Actions are stable in Next.js 15 — no longer under experimental
  serverActions: {
    bodySizeLimit: "10mb",
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
