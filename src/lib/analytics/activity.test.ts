import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  activityPath,
  csvCell,
  isPageRequest,
  isPublicDocumentPath,
  publicActivityPath,
  retentionCutoff,
} from "./activity-contract";
import { requireActivityAdmin } from "./activity-auth";
import { browserSession } from "./browser-session";
import { byteRange, servePublicDocument } from "./public-file";
import { reportCsv, reportFilter, reportWhere } from "./activity-report";
import {
  activityEnabled,
  activityEnvironment,
  activityHostAllowed,
  activityHashes,
  cleanupActivityEvents,
  writeActivity,
  RETENTION_SQL,
} from "./activity-store";
import { activityReport } from "./activity-report";

afterEach(() => vi.unstubAllEnvs());
describe("minimized activity evidence", () => {
  it("removes private URL parameters and redacts identity/token path segments", () => {
    expect(activityPath("/documents/report.pdf?access=secret#private")).toBe(
      "/documents/report.pdf",
    );
    expect(activityPath("/documents/report.pdf%3Faccess%3Dsecret")).toBe(
      "/documents/report.pdf",
    );
    expect(activityPath("/profile/jane@example.com")).toBe("/profile/[redacted]");
    expect(publicActivityPath("/api/pr-center/session")).toBe(false);
    expect(publicActivityPath("/pr-center-internal")).toBe(false);
    expect(isPublicDocumentPath("/recruitment-director-regulation-2569.pdf")).toBe(true);
    expect(isPublicDocumentPath("/private-documents/secret.pdf")).toBe(false);
    expect(isPublicDocumentPath("/wp-content/uploads/2026/test.xlsx")).toBe(true);
  });
  it("separates document requests and excludes RSC/prefetch traffic from page requests", () => {
    expect(isPageRequest("/news", new Headers())).toBe(true);
    expect(
      isPageRequest("/", new Headers({ host: "127.0.0.1:3000", "user-agent": "node" })),
    ).toBe(false);
    expect(isPageRequest("/news", new Headers({ rsc: "1" }))).toBe(false);
    expect(isPageRequest("/news", new Headers({ "next-router-prefetch": "1" }))).toBe(
      false,
    );
    expect(isPageRequest("/r/mot-5440", new Headers())).toBe(false);
    expect(isPageRequest("/file.pdf", new Headers())).toBe(false);
  });
  it("subtracts three calendar months with Bangkok month-end boundaries", () => {
    expect(retentionCutoff(new Date("2026-07-31T23:10:00+07:00")).toISOString()).toBe(
      "2026-04-30T16:10:00.000Z",
    );
    expect(retentionCutoff(new Date("2024-05-31T00:30:00+07:00")).toISOString()).toBe(
      "2024-02-28T17:30:00.000Z",
    );
    expect(RETENTION_SQL).toContain("web_activity_events_v2");
    expect(RETENTION_SQL).toContain("INTERVAL '3 months'");
    expect(RETENTION_SQL).not.toContain("redirect_clicks");
    expect(RETENTION_SQL).not.toContain("web_analytics_events");
  });
  it("can only activate for the explicit staging environment", () => {
    vi.stubEnv("ACTIVITY_LOGGING_ENABLED", "true");
    vi.stubEnv("ANALYTICS_ENV", "test");
    vi.stubEnv("SITE_ORIGIN", "https://test.rtrda.or.th");
    expect(activityEnabled()).toBe(true);
    vi.stubEnv("ANALYTICS_ENV", "production");
    expect(activityEnabled()).toBe(false);
    vi.stubEnv("ANALYTICS_ENV", "test");
    vi.stubEnv("SITE_ORIGIN", "https://rtrda.or.th");
    expect(activityEnabled()).toBe(false);
  });
  it("uses daily pseudonyms and shared session attribution without retaining raw IP/cookies", () => {
    vi.stubEnv("ANALYTICS_HASH_SALT", "synthetic-test-salt");
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const headers = new Headers({
      "cf-connecting-ip": "192.0.2.20",
      cookie: `auth=secret; rtrda_activity_session=${id}`,
    });
    const a = activityHashes(headers, null, new Date("2026-10-01T12:00:00+07:00"));
    const b = activityHashes(headers, id, new Date("2026-10-01T23:59:00+07:00"));
    const c = activityHashes(headers, id, new Date("2026-10-02T00:00:00+07:00"));
    expect(a).toEqual(b);
    expect(a.visitorKey).not.toBe(c.visitorKey);
    expect(a.sessionKey).toBe(c.sessionKey);
    expect(JSON.stringify(a)).not.toMatch(/192\.0\.2|secret|aaaaaaaa/);
  });
  it("renews browser sessions after 30 minutes idle", () => {
    let saved: string | null = null;
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    };
    const one = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      two = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    expect(browserSession(storage, 1000, () => one)).toBe(one);
    expect(browserSession(storage, 2000, () => two)).toBe(one);
    expect(browserSession(storage, 1802000, () => two)).toBe(two);
  });
});

describe("existing admin authorization and safe reports", () => {
  const cookie = new Headers({
    cookie: "unrelated=private; rtrda_pr_center_oidc_session=synthetic",
  });
  it("requires existing SSO and global admin authority", async () => {
    const fetcher = vi.fn();
    expect((await requireActivityAdmin(new Headers(), fetcher))?.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(
      Response.json({
        roles: ["RTRDA_ADMIN"],
        roleGrants: [{ role: "RTRDA_ADMIN", departmentId: "department" }],
      }),
    );
    expect((await requireActivityAdmin(cookie, fetcher))?.status).toBe(403);
    fetcher.mockImplementation(async () => Response.json({ isRootAdministrator: true }));
    expect(await requireActivityAdmin(cookie, fetcher)).toBeNull();
    expect(fetcher.mock.calls.at(-1)?.[1].headers.cookie).toBe(
      "rtrda_pr_center_oidc_session=synthetic",
    );
    fetcher.mockResolvedValue(
      Response.json({ roleGrants: [{ role: "RTRDA_ADMIN", departmentId: null }] }),
    );
    expect(await requireActivityAdmin(cookie, fetcher)).toBeNull();
  });
  it("fails closed when session verification fails", async () => {
    expect(
      (
        await requireActivityAdmin(
          cookie,
          vi.fn().mockRejectedValue(new Error("offline")),
        )
      )?.status,
    ).toBe(503);
    expect(
      (
        await requireActivityAdmin(
          cookie,
          vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
        )
      )?.status,
    ).toBe(401);
  });
  it("validates Bangkok dates, strips query data, and parameterizes route filters", () => {
    vi.stubEnv("ACTIVITY_LOGGING_ENABLED", "true");
    vi.stubEnv("ANALYTICS_ENV", "test");
    vi.stubEnv("SITE_ORIGIN", "https://test.rtrda.or.th");
    const f = reportFilter(
      new URLSearchParams({
        from: "2026-10-01",
        to: "2026-10-01",
        path: "/news?email=secret",
        type: "page_view",
      }),
      new Date("2026-10-23T12:00:00Z"),
    );
    expect(f.from.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(f.until.toISOString()).toBe("2026-10-01T17:00:00.000Z");
    expect(f.path).toBe("/news");
    expect(reportWhere(f).sql).not.toContain("/news");
    for (const params of [
      { from: "2026-02-30" },
      { page: "-1" },
      { type: "password" },
      { format: "sql" },
    ])
      expect(() =>
        reportFilter(
          new URLSearchParams(
            Object.entries(params).map(([key, value]) => [key, String(value)]),
          ),
        ),
      ).toThrow();
  });
  it("neutralizes CSV formulas and exports only the explicit safe fields", () => {
    expect(csvCell("=cmd()")).toBe('"\'=cmd()"');
    const csv = reportCsv([
      { path: "/@evil", outcome: "=formula", raw_ip: "192.0.2.2", password: "secret" },
    ]);
    expect(csv).not.toContain("192.0.2.2");
    expect(csv).not.toContain("secret");
    expect(csv).toContain("'=formula");
  });
});

describe("file response semantics", () => {
  it("supports byte ranges without claiming recipient completion", () => {
    expect(byteRange("bytes=2-4", 10)).toEqual({ start: 2, end: 4 });
    expect(byteRange("bytes=-3", 10)).toEqual({ start: 7, end: 9 });
    expect(byteRange("bytes=100-", 10)).toBe("invalid");
    expect(byteRange("bytes=1-2,3-4", 10)).toBe("invalid");
  });
  it("serves GET/HEAD/206/404/416 safely and prevents traversal/symlink escape", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "activity-files-"));
    try {
      await mkdir(path.join(root, "public"));
      await writeFile(path.join(root, "public", "report.pdf"), "abcdef");
      await writeFile(path.join(root, "outside.pdf"), "private");
      await symlink(
        path.join(root, "outside.pdf"),
        path.join(root, "public", "escape.pdf"),
      );
      const serve = (method: string, file = "/report.pdf", range?: string) =>
        servePublicDocument(
          new Request("https://test.rtrda.or.th/report.pdf", {
            method,
            headers: range ? { range } : undefined,
          }),
          file,
          path.join(root, "public"),
        );
      const full = await serve("GET");
      expect(full.status).toBe(200);
      expect(await full.text()).toBe("abcdef");
      expect(full.headers.get("cache-control")).toContain("no-store");
      const head = await serve("HEAD");
      expect(head.status).toBe(200);
      expect(head.body).toBeNull();
      expect(head.headers.get("content-length")).toBe("6");
      const partial = await serve("GET", "/report.pdf", "bytes=1-3");
      expect(partial.status).toBe(206);
      expect(await partial.text()).toBe("bcd");
      expect((await serve("GET", "/report.pdf", "bytes=100-")).status).toBe(416);
      for (const file of ["/absent.pdf", "/escape.pdf", "/../outside.pdf"])
        expect((await serve("GET", file)).status).toBe(404);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("production viewer auth selection", () => {
  it("retains Test PR Center authorization but never trusts that cookie in production", async () => {
    const pr = new Headers({ cookie: "rtrda_pr_center_oidc_session=synthetic" });
    const viewer = new Headers({
      cookie: "rtrda_activity_oidc_session=synthetic0000000000000000000000",
    });
    const fetcher = vi
      .fn()
      .mockImplementation(async () => Response.json({ isRootAdministrator: true }));
    vi.stubEnv("ANALYTICS_ENV", "test");
    expect(await requireActivityAdmin(pr, fetcher)).toBeNull();
    expect(fetcher.mock.calls[0][0]).toBe("http://pr-center-api:3100/session");
    fetcher.mockClear();
    vi.stubEnv("ANALYTICS_ENV", "production");
    expect((await requireActivityAdmin(pr, fetcher))?.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await requireActivityAdmin(viewer, fetcher))?.status).toBe(403);
    fetcher.mockResolvedValue(Response.json({ authorized: true }));
    expect(await requireActivityAdmin(viewer, fetcher)).toBeNull();
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe(
      "http://activity-report-auth:3101/session",
    );
    expect(fetcher.mock.calls.at(-1)?.[1].headers.cookie).toBe(
      "rtrda_activity_oidc_session=synthetic0000000000000000000000",
    );
  });
});

describe("protected production salt", () => {
  it("reads the mounted salt instead of the environment and fails closed when unreadable", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "activity-salt-"));
    const file = path.join(root, "salt.env");
    try {
      await writeFile(
        file,
        "ANALYTICS_HASH_SALT=synthetic-protected-salt-with-adequate-length\n",
        { mode: 0o600 },
      );
      vi.stubEnv("ACTIVITY_LOGGING_ENABLED", "true");
      vi.stubEnv("ACTIVITY_RETENTION_ENABLED", "true");
      vi.stubEnv("ANALYTICS_ENV", "production");
      vi.stubEnv("SITE_ORIGIN", "https://rtrda.or.th");
      vi.stubEnv("ACTIVITY_RECORDING_HOST", "cloud");
      vi.stubEnv("ANALYTICS_HASH_SALT_FILE", file);
      vi.stubEnv("ANALYTICS_HASH_SALT", "wrong-env-salt");
      expect(activityEnvironment()).toBe("production");
      expect(
        activityHashes(new Headers({ "cf-connecting-ip": "192.0.2.1" })).visitorKey,
      ).toMatch(/^[a-f0-9]{64}$/);
      await writeFile(file, "invalid");
      expect(activityEnvironment()).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("production V2 environment isolation", () => {
  const production = () => {
    vi.stubEnv("ACTIVITY_LOGGING_ENABLED", "true");
    vi.stubEnv("ACTIVITY_RETENTION_ENABLED", "true");
    vi.stubEnv("ANALYTICS_ENV", "production");
    vi.stubEnv("SITE_ORIGIN", "https://rtrda.or.th");
    vi.stubEnv("ANALYTICS_HASH_SALT", "synthetic-production-salt-with-sufficient-length");
    vi.stubEnv("ACTIVITY_RECORDING_HOST", "cloud");
  };
  it("requires all explicit production flags, origin and non-placeholder salt", () => {
    production();
    expect(activityEnvironment()).toBe("production");
    for (const [name, value] of [
      ["ACTIVITY_RETENTION_ENABLED", "false"],
      ["SITE_ORIGIN", "https://test.rtrda.or.th"],
      ["ANALYTICS_HASH_SALT", ""],
      ["ANALYTICS_HASH_SALT", "change-me"],
      ["ANALYTICS_ENV", "test"],
    ]) {
      vi.stubEnv(name, value);
      expect(activityEnvironment()).toBeNull();
      production();
    }
  });
  it("fails closed for missing or invalid recording host before V2 writes, retention or reports", async () => {
    production();
    const { activityPool } = await import("./activity-store");
    const query = vi.spyOn(activityPool(), "query");
    try {
      for (const host of ["", "other", "Cloud", "cloud,rtrda02"]) {
        vi.stubEnv("ACTIVITY_RECORDING_HOST", host);
        expect(activityEnvironment()).toBeNull();
        expect(
          await writeActivity(new Headers({ host: "rtrda.or.th" }), {
            eventType: "page_view",
            path: "/news",
            channel: "client",
            outcome: "browser_observed",
          }),
        ).toBe(false);
        expect(await cleanupActivityEvents()).toBe(0);
        await expect(
          activityReport(reportFilter(new URLSearchParams())),
        ).rejects.toThrow();
      }
      expect(query).not.toHaveBeenCalled();
    } finally {
      query.mockRestore();
    }
  });
  it("accepts a known internal reverse-proxy Host only with a single public forwarded authority", () => {
    production();
    for (const internal of [
      "localhost:3000",
      "127.0.0.1:3000",
      "web-app-rtrda-production:3000",
    ]) {
      expect(
        activityHostAllowed(
          new Headers({ host: internal, "x-forwarded-host": "rtrda.or.th" }),
        ),
      ).toBe(true);
      expect(activityHostAllowed(new Headers({ host: internal }))).toBe(false);
    }
    expect(activityHostAllowed(new Headers({ host: "www.rtrda.or.th" }))).toBe(true);
    expect(
      activityHostAllowed(
        new Headers({ host: "rtrda.or.th", "x-forwarded-host": "www.rtrda.or.th" }),
      ),
    ).toBe(false);
    for (const forwarded of [
      "evil.example",
      "rtrda.or.th, evil.example",
      "rtrda.or.th:443",
      "rtrda.or.th.evil.example",
      "https://rtrda.or.th",
      "rtrda.or.th;evil",
    ]) {
      expect(
        activityHostAllowed(
          new Headers({ host: "localhost:3000", "x-forwarded-host": forwarded }),
        ),
      ).toBe(false);
    }
    expect(
      activityHostAllowed(
        new Headers({ host: "evil.example", "x-forwarded-host": "rtrda.or.th" }),
      ),
    ).toBe(false);
  });
  it("denies unknown or conflicting production hosts before storage", async () => {
    production();
    const event = {
      eventType: "page_view" as const,
      path: "/news",
      channel: "client" as const,
      outcome: "browser_observed",
    };
    for (const headers of [
      new Headers({ host: "evil.example" }),
      new Headers({ host: "rtrda.or.th", "x-forwarded-host": "evil.example" }),
      new Headers(),
    ])
      expect(await writeActivity(headers, event)).toBe(false);
  });
  it("segregates inserts, retention and reports by parameterized environment", async () => {
    production();
    const { activityPool } = await import("./activity-store");
    const pool = activityPool();
    const query = vi
      .spyOn(pool, "query")
      .mockResolvedValue({ rowCount: 1, rows: [{ events: 1 }] } as never);
    try {
      expect(
        await writeActivity(new Headers({ host: "www.rtrda.or.th" }), {
          eventType: "page_view",
          path: "/news",
          channel: "client",
          outcome: "browser_observed",
        }),
      ).toBe(true);
      expect(query.mock.calls[0][0]).toContain("web_activity_events_v2");
      expect(query.mock.calls[0][1]).toContain("production");
      await cleanupActivityEvents();
      expect(
        query.mock.calls.some(
          ([sql, values]) =>
            String(sql).startsWith("DELETE") && (values as unknown[])[0] === "production",
        ),
      ).toBe(true);
      const filter = reportFilter(
        new URLSearchParams(),
        new Date("2026-10-24T00:00:00Z"),
      );
      expect(reportWhere(filter).values[0]).toBe("production");
      expect((await activityReport(filter)).recordingSource).toBe(
        "cloud production database",
      );
      expect(
        query.mock.calls
          .filter(([sql]) => String(sql).startsWith("SELECT"))
          .every(([, values]) => (values as unknown[])[0] === "production"),
      ).toBe(true);
      vi.stubEnv("ANALYTICS_ENV", "test");
      vi.stubEnv("SITE_ORIGIN", "https://test.rtrda.or.th");
      expect(reportWhere(filter).values[0]).toBe("test");
      await cleanupActivityEvents();
      expect(query.mock.calls.at(-1)?.[1]).toContain("test");
    } finally {
      query.mockRestore();
    }
  });
  it("requires an explicit recording host before querying production reports", async () => {
    production();
    vi.stubEnv("ACTIVITY_RECORDING_HOST", "");
    const { activityPool } = await import("./activity-store");
    const query = vi.spyOn(activityPool(), "query");
    try {
      await expect(activityReport(reportFilter(new URLSearchParams()))).rejects.toThrow(
        "Recording host unavailable",
      );
      expect(query).not.toHaveBeenCalled();
    } finally {
      query.mockRestore();
    }
  });
  it("denies disabled reports without issuing queries", async () => {
    production();
    vi.stubEnv("ANALYTICS_HASH_SALT", "");
    const { activityPool } = await import("./activity-store");
    const query = vi.spyOn(activityPool(), "query");
    try {
      await expect(activityReport(reportFilter(new URLSearchParams()))).rejects.toThrow();
      expect(query).not.toHaveBeenCalled();
    } finally {
      query.mockRestore();
    }
  });
});
