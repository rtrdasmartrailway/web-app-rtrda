const CSP_BASE_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://docs.google.com https://forms.gle https://www.enablesurvey.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https:",
  "connect-src 'self' https://cloudflareinsights.com",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://docs.google.com https://drive.google.com https://www.google.com https://www.enablesurvey.com",
];

export const CONTENT_SECURITY_POLICY = [
  ...CSP_BASE_DIRECTIVES,
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
].join("; ");

export const CONTENT_SECURITY_POLICY_REPORT_ONLY = [
  ...CSP_BASE_DIRECTIVES,
  "script-src 'self'",
].join("; ");

export const SAME_ORIGIN_FRAME_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Content-Security-Policy-Report-Only", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

export const INLINE_PDF_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  ...SAME_ORIGIN_FRAME_HEADERS,
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  {
    key: "Content-Security-Policy",
    value: CONTENT_SECURITY_POLICY,
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: CONTENT_SECURITY_POLICY_REPORT_ONLY,
  },
  { key: "Strict-Transport-Security", value: "max-age=86400" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Download-Options", value: "noopen" },
];
