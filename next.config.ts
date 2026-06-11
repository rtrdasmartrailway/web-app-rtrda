import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    cpus: 4,
  },
  async headers() {
    // Cap CDN caching for mirrored assets. Next's default 1-year s-maxage
    // also applies to 404 responses, which let Cloudflare cache a "missing"
    // asset for a year if it was requested before the importer mirrored it.
    return [
      {
        source: "/wp-content/uploads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=14400, s-maxage=86400" },
        ],
      },
      {
        source: "/sdc-downloads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=14400, s-maxage=86400" },
        ],
      },
    ];
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
      // "teluro" (the intranet theme's front-page slug) is the intranet home.
      {
        source: "/rtrdaintranet/index.php/teluro",
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
