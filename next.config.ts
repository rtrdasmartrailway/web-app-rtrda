import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    cpus: 4,
  },
  async redirects() {
    // WordPress served search at /?s=<term>; keep those URLs working.
    return [
      {
        source: "/",
        has: [{ type: "query", key: "s", value: "(?<term>.*)" }],
        destination: "/search?q=:term",
        permanent: false,
      },
      {
        source: "/en",
        has: [{ type: "query", key: "s", value: "(?<term>.*)" }],
        destination: "/search?q=:term&lang=en",
        permanent: false,
      },
      // The legacy intranet exposed routes both with and without index.php.
      {
        source: "/rtrdaintranet/index.php",
        destination: "/rtrdaintranet",
        permanent: false,
      },
      {
        source: "/rtrdaintranet/index.php/:path*",
        destination: "/rtrdaintranet/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
