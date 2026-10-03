import { describe, expect, it } from "vitest";
import {
  createWorkerHealthResponse,
  isEmailRecipientAllowed,
  parseEmailOutboxPayload,
  retryDelayMs,
} from "./outbox-worker";

describe("email outbox worker guards", () => {
  it("accepts a plain-text notification payload", () => {
    expect(
      parseEmailOutboxPayload({
        to: " person@example.org ",
        subject: "Reminder",
        body: "A task is due.",
      }),
    ).toEqual({
      to: "person@example.org",
      subject: "Reminder",
      body: "A task is due.",
    });
  });

  it("rejects malformed recipients and email header injection", () => {
    expect(
      parseEmailOutboxPayload({ to: "unknown", subject: "Reminder", body: "text" }),
    ).toBeNull();
    expect(
      parseEmailOutboxPayload({
        to: "person@example.org",
        subject: "Reminder\r\nBcc: other@example.org",
        body: "text",
      }),
    ).toBeNull();
  });

  it("enforces exact allowlist membership case-insensitively", () => {
    expect(
      isEmailRecipientAllowed(
        "Person@Example.org",
        "person@example.org,other@example.org",
      ),
    ).toBe(true);
    expect(
      isEmailRecipientAllowed("person@example.org.attacker.test", "person@example.org"),
    ).toBe(false);
  });

  it("uses capped exponential retry delay", () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(20)).toBe(60 * 60_000);
  });

  it("reports readiness explicitly instead of equating liveness with delivery", () => {
    expect(createWorkerHealthResponse(false)).toEqual({
      service: "pr-center-email-outbox",
      ready: false,
    });
  });
});
