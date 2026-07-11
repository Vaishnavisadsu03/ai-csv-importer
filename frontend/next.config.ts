import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/:path*`,
      },
    ];
  },

  experimental: {
    // Enables React 19 features support with Next.js 15
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
