import { describe, expect, it, vi } from "vitest";
import { buildPrCenterApi, type EntraAuth } from "./app";

const mockActor = {
  id: "user-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "PR_OPERATIONS" as const,
};

describe("OIDC callback failures", () => {
  it("revokes the OIDC session before returning to sign-in", async () => {
    const entraAuth: EntraAuth = {
      resolve: vi.fn(),
      begin: vi.fn(),
      callback: vi.fn().mockRejectedValue(new Error("token exchange failed")),
      signOut: vi.fn(() => ["rtrda_pr_center_oidc_session=; Max-Age=0"]),
    };
    const app = buildPrCenterApi(vi.fn(), entraAuth);

    const response = await app.inject({
      method: "GET",
      url: "/auth/callback?code=sensitive&state=sensitive",
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("/rtrdaintranet/prcenter?signin=failed");
    expect(response.headers["set-cookie"]).toContain(
      "rtrda_pr_center_oidc_session=; Max-Age=0",
    );
    await app.close();
  });
});

describe("File and attachment route guards", () => {
  it("rejects unauthenticated file upload", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/files",
      payload: { fileName: "test.pdf", mimeType: "application/pdf", content: "dGVzdA==" },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects file upload with missing fields", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({
      method: "POST",
      url: "/files",
      payload: { fileName: "test.pdf" },
    });
    expect(response.statusCode).toBe(422);
    const body = response.json();
    expect(body.error).toBe("INVALID_BODY");
    await app.close();
  });

  it("rejects file upload with empty base64 content", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({
      method: "POST",
      url: "/files",
      payload: { fileName: "test.pdf", mimeType: "application/pdf", content: "" },
    });
    expect(response.statusCode).toBe(422);
    const body = response.json();
    expect(body.error).toBe("EMPTY_FILE");
    await app.close();
  });

  it("rejects unauthenticated attachment list", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "GET",
      url: "/attachments?requestId=some-id",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects unauthenticated file download", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "GET",
      url: "/files/some-id/download",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects unauthenticated attachment removal", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "DELETE",
      url: "/attachments/some-id",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects unauthenticated final asset assignment", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/tasks/some-id/final-asset",
      headers: { "if-match": "1" },
      payload: { fileId: "file-id" },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("Access administration route guards", () => {
  const adminActor = {
    ...mockActor,
    role: "SCOPED_ADMINISTRATOR" as const,
  };

  it("rejects unauthenticated admin user list", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({ method: "GET", url: "/admin/users" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects non-admin role from listing users", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({ method: "GET", url: "/admin/users" });
    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error).toBe("FORBIDDEN");
    await app.close();
  });

  it("rejects non-admin role from granting roles", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({
      method: "POST",
      url: "/admin/users/some-id/roles",
      payload: { role: "REQUESTER" },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("rejects invalid role code in grant request", async () => {
    const app = buildPrCenterApi(async () => adminActor);
    const response = await app.inject({
      method: "POST",
      url: "/admin/users/some-id/roles",
      payload: { role: "INVALID_ROLE" },
    });
    expect(response.statusCode).toBe(422);
    const body = response.json();
    expect(body.error).toBe("INVALID_ROLE");
    await app.close();
  });

  it("rejects non-admin role from revoking roles", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({
      method: "DELETE",
      url: "/admin/roles/some-role-id",
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("rejects non-admin role from toggling user active", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({
      method: "PATCH",
      url: "/admin/users/some-id/active",
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("rejects non-admin role from viewing access audit", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({ method: "GET", url: "/admin/access-audit" });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("rejects unauthenticated access audit", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({ method: "GET", url: "/admin/access-audit" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects unauthenticated role revocation", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({ method: "DELETE", url: "/admin/roles/some-id" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects unauthenticated user active toggle", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "PATCH",
      url: "/admin/users/some-id/active",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("Notification policy route guards", () => {
  it("rejects unauthenticated evaluate-reminders", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/notifications/evaluate-reminders",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects non-admin role from evaluate-reminders", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({
      method: "POST",
      url: "/notifications/evaluate-reminders",
    });
    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error).toBe("FORBIDDEN");
    await app.close();
  });
});

describe("Quarantine management route guards", () => {
  const adminActor = {
    ...mockActor,
    role: "SCOPED_ADMINISTRATOR" as const,
  };

  it("rejects unauthenticated quarantine list", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({ method: "GET", url: "/admin/quarantine" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects non-admin/operations role from listing quarantined files", async () => {
    const requesterActor = { ...mockActor, role: "REQUESTER" as const };
    const app = buildPrCenterApi(async () => requesterActor);
    const response = await app.inject({ method: "GET", url: "/admin/quarantine" });
    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error).toBe("FORBIDDEN");
    await app.close();
  });

  it("rejects unauthenticated quarantine review", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/admin/quarantine/some-id/review",
      payload: { disposition: "approve" },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects invalid disposition in quarantine review", async () => {
    const app = buildPrCenterApi(async () => adminActor);
    const response = await app.inject({
      method: "POST",
      url: "/admin/quarantine/some-id/review",
      payload: { disposition: "invalid" },
    });
    expect(response.statusCode).toBe(422);
    const body = response.json();
    expect(body.error).toBe("INVALID_DISPOSITION");
    await app.close();
  });

  it("rejects unauthenticated quarantine rescan", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/admin/quarantine/some-id/rescan",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("allows PR_OPERATIONS to list quarantined files", async () => {
    const opsActor = { ...mockActor, role: "PR_OPERATIONS" as const };
    const app = buildPrCenterApi(async () => opsActor);
    const response = await app.inject({ method: "GET", url: "/admin/quarantine" });
    // Should not be 403 - will be 200 (even if empty result from DB)
    expect(response.statusCode).not.toBe(403);
    await app.close();
  });
});

describe("Audit export route guards", () => {
  const adminActor = {
    ...mockActor,
    role: "SCOPED_ADMINISTRATOR" as const,
  };

  it("rejects unauthenticated audit export", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/audit/export",
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects non-admin role from audit export", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({
      method: "POST",
      url: "/audit/export",
      payload: {},
    });
    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error).toBe("FORBIDDEN");
    await app.close();
  });

  it("rejects non-POST body on audit export", async () => {
    const app = buildPrCenterApi(async () => adminActor);
    const response = await app.inject({
      method: "POST",
      url: "/audit/export",
      payload: "not-json",
      headers: { "content-type": "text/plain" },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe("Restore request route guards", () => {
  const adminActor = {
    ...mockActor,
    role: "SCOPED_ADMINISTRATOR" as const,
  };

  it("rejects unauthenticated restore", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "POST",
      url: "/requests/some-id/restore",
      headers: { "if-match": "1" },
      payload: { reason: "test" },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects non-admin role from restore", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({
      method: "POST",
      url: "/requests/00000000-0000-4000-8000-000000000001/restore",
      headers: { "if-match": "1" },
      payload: { reason: "test" },
    });
    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error).toBe("FORBIDDEN");
    await app.close();
  });

  it("rejects restore without If-Match header", async () => {
    const app = buildPrCenterApi(async () => adminActor);
    const response = await app.inject({
      method: "POST",
      url: "/requests/00000000-0000-4000-8000-000000000001/restore",
      payload: { reason: "test" },
    });
    expect(response.statusCode).toBe(428);
    await app.close();
  });
});

describe("Release readiness route guards", () => {
  it("rejects unauthenticated release readiness", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "GET",
      url: "/admin/release-readiness",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects non-admin role from release readiness", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({
      method: "GET",
      url: "/admin/release-readiness",
    });
    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error).toBe("FORBIDDEN");
    await app.close();
  });
});

describe("Content Ideas create route", () => {
  it("rejects malformed structured metadata before any database write", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const response = await app.inject({
      method: "POST",
      url: "/ideas",
      payload: {
        title: "A valid idea",
        rationale: "A valid rationale",
        pillar: 12,
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "INVALID_IDEA",
      message: "Idea pillar must be text",
    });
    await app.close();
  });
});

describe("Message House current route", () => {
  it("requires an authenticated actor", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({ method: "GET", url: "/message-house/current" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("requires an authenticated actor to read version history", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({ method: "GET", url: "/message-house/history" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("denies current and historical content to roles without page access", async () => {
    const requesterActor = { ...mockActor, role: "REQUESTER" as const };
    const app = buildPrCenterApi(async () => requesterActor);
    const [currentResponse, historyResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/message-house/current" }),
      app.inject({ method: "GET", url: "/message-house/history" }),
    ]);

    expect(currentResponse.statusCode).toBe(403);
    expect(historyResponse.statusCode).toBe(403);
    await app.close();
  });
});

describe("Calendar route", () => {
  it("requires an authenticated actor", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "GET",
      url: "/calendar?from=2026-10-01T00:00:00.000Z&to=2026-10-08T00:00:00.000Z",
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects invalid and overlong ranges before querying the database", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const [invalidResponse, overlongResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/calendar?from=nope&to=2026-10-08T00:00:00.000Z",
      }),
      app.inject({
        method: "GET",
        url: "/calendar?from=2026-10-01T00:00:00.000Z&to=2026-12-01T00:00:00.000Z",
      }),
    ]);

    expect(invalidResponse.statusCode).toBe(422);
    expect(invalidResponse.json().error).toBe("INVALID_CALENDAR_RANGE");
    expect(overlongResponse.statusCode).toBe(422);
    expect(overlongResponse.json().error).toBe("INVALID_CALENDAR_RANGE");
    await app.close();
  });
});

describe("Content Ideas list route", () => {
  it("requires authentication", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({ method: "GET", url: "/ideas?take=50&offset=0" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("validates pagination, search, and status filters before any database read", async () => {
    const app = buildPrCenterApi(async () => mockActor);
    const [invalidPagination, invalidStatus, overlongSearch] = await Promise.all([
      app.inject({ method: "GET", url: "/ideas?take=101&offset=0" }),
      app.inject({ method: "GET", url: "/ideas?status=INVALID" }),
      app.inject({
        method: "GET",
        url: `/ideas?search=${"x".repeat(101)}`,
      }),
    ]);

    for (const response of [invalidPagination, invalidStatus, overlongSearch]) {
      expect(response.statusCode).toBe(422);
      expect(response.json().error).toBe("INVALID_IDEA_LIST_QUERY");
    }
    await app.close();
  });
});
