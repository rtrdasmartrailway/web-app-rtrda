import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    cpus: 4,
  },
  async redirects() {
    return [
      {
        source: "/%E0%B8%AD%E0%B8%B4%E0%B8%99%E0%B8%97%E0%B8%A3%E0%B8%B2%E0%B9%80%E0%B8%99%E0%B9%87%E0%B8%95/:path*",
        destination: "/rtrdaintranet/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
