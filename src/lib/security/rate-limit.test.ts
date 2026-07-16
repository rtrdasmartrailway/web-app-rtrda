import { describe, expect, it } from "vitest";
import { createFixedWindowLimiter } from "./rate-limit";

describe("createFixedWindowLimiter", () => {
  it("allows requests up to the configured write limit", () => {
    const limiter = createFixedWindowLimiter({
      limit: 3,
      windowMs: 60_000,
      maxKeys: 100,
    });

    expect(limiter.allow("campaign:visitor", 0)).toBe(true);
    expect(limiter.allow("campaign:visitor", 1)).toBe(true);
    expect(limiter.allow("campaign:visitor", 2)).toBe(true);
    expect(limiter.allow("campaign:visitor", 3)).toBe(false);
  });

  it("resets the budget after the fixed window", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 1_000, maxKeys: 100 });

    expect(limiter.allow("key", 0)).toBe(true);
    expect(limiter.allow("key", 999)).toBe(false);
    expect(limiter.allow("key", 1_000)).toBe(true);
  });

  it("keeps separate budgets per key", () => {
    const limiter = createFixedWindowLimiter({
      limit: 1,
      windowMs: 60_000,
      maxKeys: 100,
    });

    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 1)).toBe(false);
    expect(limiter.allow("b", 1)).toBe(true);
  });

  it("bounds memory by evicting the oldest key", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });

    expect(limiter.allow("oldest", 0)).toBe(true);
    expect(limiter.allow("newer", 1)).toBe(true);
    expect(limiter.allow("newest", 2)).toBe(true);
    expect(limiter.size()).toBe(2);
    expect(limiter.allow("oldest", 3)).toBe(true);
  });
});
