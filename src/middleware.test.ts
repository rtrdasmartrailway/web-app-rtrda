import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy as middleware } from "./proxy";

function request(
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): NextRequest {
  return new NextRequest(url, init);
}

describe("security middleware", () => {
  it("redirects proxy-confirmed HTTP requests to the same HTTPS URL", () => {
    const response = middleware(
      request("http://rtrda.or.th/search?q=rail", {
        headers: { "x-forwarded-proto": "http" },
      }),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://rtrda.or.th/search?q=rail");
  });

  it("does not redirect direct internal HTTP health probes without a proxy header", () => {
    const response = middleware(request("http://127.0.0.1:3020/healthz"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not redirect internal health probes when Next.js supplies x-forwarded-proto", () => {
    const response = middleware(
      request("http://127.0.0.1:3020/healthz", {
        headers: { host: "127.0.0.1:3020", "x-forwarded-proto": "http" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/healthz", "/api/health"])(
    "does not redirect %s even when a watchdog sends the public Host header",
    (path) => {
      const response = middleware(
        request(`http://100.77.64.92:3021${path}`, {
          headers: {
            host: "rtrda.or.th",
            "x-forwarded-host": "rtrda.or.th",
            "x-forwarded-proto": "http",
          },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "rejects unsupported %s requests",
    (method) => {
      const response = middleware(request("https://test.rtrda.or.th/", { method }));

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    },
  );

  it("allows POST only for the analytics collector", () => {
    const allowed = middleware(
      request("https://test.rtrda.or.th/api/analytics/events", { method: "POST" }),
    );
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("x-middleware-next")).toBe("1");

    const blocked = middleware(
      request("https://test.rtrda.or.th/api/other", { method: "POST" }),
    );
    expect(blocked.status).toBe(405);
  });

  it("allows POST for the protected download CAPTCHA", () => {
    const response = middleware(
      request("https://test.rtrda.or.th/api/download-captcha", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("advertises only POST and OPTIONS for the analytics collector", () => {
    const response = middleware(
      request("https://test.rtrda.or.th/api/analytics/events", { method: "OPTIONS" }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("allow")).toBe("POST, OPTIONS");
  });

  it("answers OPTIONS without rendering the application", () => {
    const response = middleware(
      request("https://test.rtrda.or.th/", { method: "OPTIONS" }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
  });
});

describe("Intro gate on the production middleware", () => {
  it.each(["https://test.rtrda.or.th", "https://www.rtrda.or.th"])(
    "redirects %s/ to its own Intro page",
    (origin) => {
      const response = middleware(request(origin + "/"));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(origin + "/intro");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("consumes the return marker to serve the homepage only once", () => {
    const response = middleware(
      request("https://www.rtrda.or.th/", {
        headers: { cookie: "rtrda-intro-return=1" },
      }),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("set-cookie")).toContain("rtrda-intro-return=;");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("keeps the Intro page publicly reachable", () => {
    const response = middleware(request("https://www.rtrda.or.th/intro"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("Intro root behind a reverse proxy", () => {
  it("redirects to the public HTTPS Intro instead of the internal request URL", () => {
    const response = middleware(
      request("http://localhost:39877/", {
        headers: {
          host: "localhost:39877",
          "x-forwarded-host": "www.rtrda.or.th",
          "x-forwarded-proto": "https",
        },
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.rtrda.or.th/intro");
  });
});

describe("Production request policy with activity interception", () => {
  beforeEach(() => {
    vi.stubEnv("ANALYTICS_ENV", "production");
    vi.stubEnv("ACTIVITY_LOGGING_ENABLED", "true");
    vi.stubEnv("ACTIVITY_RETENTION_ENABLED", "true");
    vi.stubEnv("SITE_ORIGIN", "https://rtrda.or.th");
    vi.stubEnv("ANALYTICS_HASH_SALT", "synthetic-production-salt-with-sufficient-length");
    vi.stubEnv("ACTIVITY_RECORDING_HOST", "cloud");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("leaves the legacy public file path untouched when V2 is disabled", () => {
    vi.stubEnv("ACTIVITY_LOGGING_ENABLED", "false");
    const response = middleware(
      request("https://rtrda.or.th/wp-content/uploads/guide.pdf", {
        headers: { host: "rtrda.or.th" },
      }),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it("denies an untrusted Host to activity interception", () => {
    const response = middleware(
      request("https://evil.example/wp-content/uploads/guide.pdf", {
        headers: { host: "evil.example", "x-forwarded-host": "rtrda.or.th" },
      }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it("rewrites a public PDF GET to private file delivery", () => {
    const response = middleware(
      request("https://rtrda.or.th/wp-content/uploads/guide.pdf", {
        headers: { host: "rtrda.or.th" },
      }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/logged-files-internal/wp-content/uploads/guide.pdf",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("preserves method denial before activity interception", () => {
    const response = middleware(
      request("https://rtrda.or.th/wp-content/uploads/guide.pdf", { method: "POST" }),
    );
    expect(response.status).toBe(405);
  });
  it("preserves the legacy O10 rewrite when activity is on", () => {
    const response = middleware(
      request(
        "https://rtrda.or.th/wp-content/uploads/ita2569/O10/o10-%25E0%25B8%2584%25E0%25B8%25B9%2520%2520%25E0%25B9%2588%25E0%25B8%25A1%25E0%25B%2520%25208%25B7%25E0%25B8%25AD%25E0%25B8%2581%2520%2520%25E0%25B8%25B2%25E0%25B8%25A3%25E%2520%25200%25B9%2583%25E0%25B8%25AB%25E0%25B9%258%2520%25209%25E0%25B8%259A%25E0%25B8%25A3%25E0%2520%2520%25B8%25B4%25E0%25B8%2581%25E0%25B8%2520%2520%25B2%25E0%25B8%25A3-E-Service.pdf",
      ),
    );
    expect(response.headers.get("x-middleware-rewrite")).toContain("E-Service.pdf");
  });
});
