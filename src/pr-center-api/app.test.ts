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
