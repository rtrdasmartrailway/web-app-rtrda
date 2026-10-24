import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ write: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/analytics/activity-store", () => ({
  activityEnabled: () => true,
  activityHashes: () => ({ visitorKey: "synthetic" }),
  writeActivity: mocks.write,
}));
import { POST } from "./route";
const valid = {
  eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  eventType: "page_view",
  path: "/news?private=secret",
  targetPath: null,
  source: "direct",
};
function request(body: unknown, origin = "https://test.rtrda.or.th") {
  return new NextRequest("https://test.rtrda.or.th/api/analytics/events", {
    method: "POST",
    headers: {
      origin,
      host: "test.rtrda.or.th",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
afterEach(() => vi.clearAllMocks());
describe("activity collector isolation", () => {
  it("normalizes browser observations, maps clicks honestly, and sets only the dedicated pseudonymous session cookie", async () => {
    const response = await POST(
      request({
        ...valid,
        eventType: "download",
        targetPath: "/report.pdf?access=secret",
      }),
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true });
    expect(mocks.write.mock.calls[0][1]).toMatchObject({
      path: "/news",
      targetPath: "/report.pdf",
      eventType: "download_click",
      outcome: "click_not_confirmed_download",
    });
    expect(response.cookies.get("rtrda_activity_session")?.value).toBe(valid.sessionId);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("rejects cross-origin, private/admin paths and unexpected form-value fields before storing", async () => {
    expect((await POST(request(valid, "https://evil.example"))).status).toBe(403);
    expect(
      (await POST(request({ ...valid, path: "/api/pr-center/session" }))).status,
    ).toBe(400);
    expect((await POST(request({ ...valid, path: "/pr-center-internal" }))).status).toBe(
      400,
    );
    expect((await POST(request({ ...valid, password: "do-not-store" }))).status).toBe(
      400,
    );
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("accepts only safe form identifiers from the staff portal and preserves an existing file/session journey", async () => {
    const body = {
      ...valid,
      eventType: "outbound_form_click",
      path: "/rtrdaintranet",
      targetPath: "/outbound-form/short/cA3FjxyvkR1pKy5k6",
    };
    const req = request(body);
    req.headers.set(
      "cookie",
      "rtrda_activity_session=cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    );
    expect((await POST(req)).status).toBe(202);
    expect(mocks.write.mock.calls[0][1]).toMatchObject({
      eventType: "outbound_form_click",
      sessionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      outcome: "outbound_click_not_form_submission",
    });
    expect(
      (await POST(request({ ...body, targetPath: body.targetPath + "?entry.1=secret" })))
        .status,
    ).toBe(400);
    expect(
      (await POST(request({ ...body, path: "/rtrdaintranet/prcenter" }))).status,
    ).toBe(400);
  });
});
