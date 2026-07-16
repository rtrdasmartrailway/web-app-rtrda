type Bucket = {
  count: number;
  startedAt: number;
  lastSeenAt: number;
};

type FixedWindowOptions = {
  limit: number;
  windowMs: number;
  maxKeys: number;
};

export type FixedWindowLimiter = {
  allow: (key: string, now?: number) => boolean;
  size: () => number;
};

export function createFixedWindowLimiter(
  options: FixedWindowOptions,
): FixedWindowLimiter {
  if (options.limit < 1 || options.windowMs < 1 || options.maxKeys < 1) {
    throw new Error("rate-limit options must be positive integers");
  }

  const buckets = new Map<string, Bucket>();

  function evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestSeenAt = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of buckets) {
      if (bucket.lastSeenAt < oldestSeenAt) {
        oldestKey = key;
        oldestSeenAt = bucket.lastSeenAt;
      }
    }
    if (oldestKey !== null) buckets.delete(oldestKey);
  }

  return {
    allow(key: string, now = Date.now()): boolean {
      const existing = buckets.get(key);
      if (!existing || now - existing.startedAt >= options.windowMs) {
        if (!existing && buckets.size >= options.maxKeys) evictOldest();
        buckets.set(key, { count: 1, startedAt: now, lastSeenAt: now });
        return true;
      }

      existing.lastSeenAt = now;
      if (existing.count >= options.limit) return false;
      existing.count += 1;
      return true;
    },
    size: () => buckets.size,
  };
}
