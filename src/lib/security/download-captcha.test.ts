import { describe, expect, it } from "vitest";
import { issueDownloadCaptcha, verifyDownloadCaptcha } from "./download-captcha";

function answerFor(question: string): number {
  const match = question.match(/^(\d+) \+ (\d+) = \?$/);
  if (!match) throw new Error("Unexpected CAPTCHA question");
  return Number(match[1]) + Number(match[2]);
}

describe("download CAPTCHA", () => {
  it("accepts a correct answer once", () => {
    const challenge = issueDownloadCaptcha(
      "rail-technology-strategy-2571-2575",
      "127.0.0.1",
    );
    expect(challenge).not.toBeNull();
    expect(
      verifyDownloadCaptcha(
        challenge!.id,
        answerFor(challenge!.question),
        "rail-technology-strategy-2571-2575",
        "127.0.0.1",
        "download",
      ),
    ).toBe("success");
    expect(
      verifyDownloadCaptcha(
        challenge!.id,
        answerFor(challenge!.question),
        "rail-technology-strategy-2571-2575",
        "127.0.0.1",
        "download",
      ),
    ).toBe("invalid");
  });

  it("rejects expired challenges", () => {
    const now = Date.now();
    const challenge = issueDownloadCaptcha(
      "rail-technology-strategy-2571-2575",
      "127.0.0.2",
      "download",
      now,
    );
    expect(
      verifyDownloadCaptcha(
        challenge!.id,
        answerFor(challenge!.question),
        "rail-technology-strategy-2571-2575",
        "127.0.0.2",
        "download",
        now + 5 * 60 * 1000,
      ),
    ).toBe("expired");
  });
});
