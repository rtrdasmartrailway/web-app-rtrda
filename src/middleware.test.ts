import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

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
