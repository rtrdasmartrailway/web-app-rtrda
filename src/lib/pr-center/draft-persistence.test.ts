import { describe, expect, it, vi } from "vitest";
import { createDraftPersistence, createUploadCache } from "./draft-persistence";

describe("partial draft persistence ordering", () => {
  it("deletes after an in-flight PUT and skips older queued saves", async () => {
    const queue = createDraftPersistence();
    const calls: string[] = [];
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = queue.save(async () => {
      calls.push("put-start");
      await blocked;
      calls.push("put-end");
    });
    await Promise.resolve();
    await Promise.resolve();
    const older = queue.save(async () => {
      calls.push("stale-put");
    });
    const clear = queue.clear(async () => {
      calls.push("delete");
    });
    release();
    await Promise.all([first, older, clear]);
    expect(calls).toEqual(["put-start", "put-end", "delete"]);
    await queue.save(async () => {
      calls.push("new-session-put");
    });
    expect(calls.at(-1)).toBe("new-session-put");
  });
  it("propagates failures and permits a retry", async () => {
    const queue = createDraftPersistence();
    await expect(
      queue.save(async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    const retry = vi.fn(async () => {});
    await queue.save(retry);
    expect(retry).toHaveBeenCalledOnce();
  });
});
describe("attachment retry upload cache", () => {
  it("reuses the successful upload ID after failed linkage", async () => {
    const cached = createUploadCache<object>();
    const file = {};
    const upload = vi.fn(async () => "file-id");
    expect(await cached(file, upload)).toBe("file-id");
    expect(await cached(file, upload)).toBe("file-id");
    expect(upload).toHaveBeenCalledOnce();
    await cached({}, upload);
    expect(upload).toHaveBeenCalledTimes(2);
  });
  it("does not cache failed uploads", async () => {
    const cached = createUploadCache<object>();
    const file = {};
    await expect(
      cached(file, async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow();
    expect(await cached(file, async () => "retry-id")).toBe("retry-id");
  });
});
