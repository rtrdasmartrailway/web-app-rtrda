import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPrCenterApi } from "./app";

const csv = [
  "ลำดับ,หัวข้อ,จำนวน,ผู้ชม,คอมเม้น,วัน/เดือน/ปี,ผลรวมจำนวนผู้ชม,ผลรวมจำนวนคอมเม้น",
  "1,Facebook,2,120,5,17/10/2026,,",
].join("\n");

const adminActor = {
  id: "admin-1",
  organizationId: "org-1",
  departmentId: null,
  role: "RTRDA_ADMIN" as const,
  roleGrants: [{ role: "RTRDA_ADMIN" as const, departmentId: null }],
};

const regularActor = {
  id: "user-1",
  organizationId: "org-1",
  departmentId: "dept-1",
  role: "RTRDA_PR" as const,
  roleGrants: [{ role: "RTRDA_PR" as const, departmentId: "dept-1" }],
};

afterEach(() => vi.unstubAllGlobals());

describe("executive platform distribution API", () => {
  it("requires authentication", async () => {
    const app = buildPrCenterApi(async () => null);
    const response = await app.inject({
      method: "GET",
      url: "/executive/platform-distribution",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("allows authenticated staff to see the Home chart with one post per row", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(csv, { status: 200 })));
    const app = buildPrCenterApi(async () => regularActor);
    const response = await app.inject({
      method: "GET",
      url: "/executive/platform-distribution",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().totals.posts).toBe(1);
    await app.close();
  });

  it("returns only live aggregates for an administrator", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(csv, { status: 200 })));
    const app = buildPrCenterApi(async () => adminActor);
    const response = await app.inject({
      method: "GET",
      url: "/executive/platform-distribution",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      recordCount: 1,
      totals: { posts: 1, viewers: 120, comments: 5 },
    });
    expect(response.json().platforms[0]).toEqual({
      name: "Facebook",
      posts: 1,
      viewers: 120,
      comments: 5,
    });
    expect(response.json().monthly).toEqual([{ month: "2026-10", posts: 1 }]);
    await app.close();
  });

  it("rejects unsupported filters without contacting the spreadsheet", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const app = buildPrCenterApi(async () => regularActor);
    const response = await app.inject({
      method: "GET",
      url: "/executive/platform-distribution?period=31",
    });
    expect(response.statusCode).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns a safe unavailable response when the sheet cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const app = buildPrCenterApi(async () => adminActor);
    const response = await app.inject({
      method: "GET",
      url: "/executive/platform-distribution",
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error).toBe("PLATFORM_SHEET_UNAVAILABLE");
    await app.close();
  });
});
