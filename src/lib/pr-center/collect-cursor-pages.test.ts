import { describe, expect, it, vi } from "vitest";
import { collectCursorPages } from "./collect-cursor-pages";

const records = Array.from({ length: 205 }, (_, index) => ({ id: `row-${index}` }));
function pageFrom(rows: typeof records, take: number) {
  return vi.fn(async (cursor?: string) => {
    const start = cursor ? rows.findIndex((row) => row.id === cursor) + 1 : 0;
    return rows.slice(start, start + take + 1);
  });
}

describe("collectCursorPages", () => {
  it("stops after an exact full page with no sentinel", async () => {
    const load = pageFrom(records.slice(0, 100), 100);
    expect(await collectCursorPages(load)).toEqual(records.slice(0, 100));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("uses the last included row as cursor when one more row exists", async () => {
    const load = pageFrom(records.slice(0, 101), 100);
    expect(await collectCursorPages(load)).toEqual(records.slice(0, 101));
    expect(load).toHaveBeenNthCalledWith(2, "row-99");
  });

  it("includes older tasks/requests beyond the first page without duplicates", async () => {
    const load = pageFrom(records, 100);
    expect(await collectCursorPages(load)).toEqual(records);
    expect(load).toHaveBeenNthCalledWith(2, "row-99");
    expect(load).toHaveBeenNthCalledWith(3, "row-199");
  });

  it("fails closed on a non-advancing cursor or oversized page", async () => {
    await expect(
      collectCursorPages(async () => [{ id: "x" }, { id: "x" }], 1),
    ).rejects.toThrow("did not advance");
    await expect(
      collectCursorPages(async () => [{ id: "a" }, { id: "b" }, { id: "c" }], 1),
    ).rejects.toThrow("Invalid request page size");
  });
});
