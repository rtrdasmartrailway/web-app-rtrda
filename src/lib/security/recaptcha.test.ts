import { describe, expect, it } from "vitest";
import { RECAPTCHA_DOWNLOAD_ACTION, verifyRecaptcha } from "./recaptcha";

describe("download reCAPTCHA", () => {
  it("accepts a valid token for the expected action, hostname, and score", async () => {
    const verified = await verifyRecaptcha("token", RECAPTCHA_DOWNLOAD_ACTION, {
      secret: "secret",
      hostname: "test.rtrda.or.th",
      fetchFn: async () =>
        Response.json({
          action: RECAPTCHA_DOWNLOAD_ACTION,
          hostname: "test.rtrda.or.th",
          score: 0.5,
          success: true,
        }),
    });

    expect(verified).toBe(true);
  });

  it("rejects a token with the wrong action, hostname, or score", async () => {
    const verified = await verifyRecaptcha("token", RECAPTCHA_DOWNLOAD_ACTION, {
      secret: "secret",
      hostname: "test.rtrda.or.th",
      fetchFn: async () =>
        Response.json({
          action: "other_action",
          hostname: "other.example",
          score: 0.49,
          success: true,
        }),
    });

    expect(verified).toBe(false);
  });
});
