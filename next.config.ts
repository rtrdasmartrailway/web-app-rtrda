import type { NextConfig } from "next";
import { INLINE_PDF_HEADERS, SECURITY_HEADERS } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  poweredByHeader: false,
  experimental: {
    cpus: 4,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // The generated Prisma client and its native query engine live outside
  // node_modules; make sure the standalone bundle traces them in.
  outputFileTracingIncludes: {
    "/**": ["./src/generated/prisma/**"],
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
      // HTML pages: keep them on the edge briefly so bursts don't pound the
      // origin, but make sure deploys are visible within minutes. Without
      // this rule Next.js defaults to s-maxage=31536000 (1 year) which
      // makes Cloudflare's stale-while-revalidate window huge — every push
      // looks like a rollback for the next hour.
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
          },
          ...SECURITY_HEADERS,
        ],
      },
      // Inline download responses are framed only by the same RTRDA origin.
      // This route-specific policy overrides the global clickjacking denial
      // without allowing third-party sites to embed RTRDA documents.
      {
        source: "/sdc_download/:path*",
        headers: [...INLINE_PDF_HEADERS],
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
