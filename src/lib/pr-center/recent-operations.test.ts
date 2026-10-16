import { describe, expect, it } from "vitest";
import { recentOperations } from "./recent-operations";

describe("recent Content Operations", () => {
  it("shows the 10 most recently updated scoped tasks, independent of input order", () => {
    const tasks = Array.from({ length: 12 }, (_, index) => ({
      id: `task-${index}`,
      updatedAt: new Date(Date.UTC(2026, 9, index + 1)).toISOString(),
    }));
    const input = [tasks[5], ...tasks.slice(0, 5), ...tasks.slice(6)];
    expect(recentOperations(input).map((task) => task.id)).toEqual(
      tasks
        .slice(2)
        .reverse()
        .map((task) => task.id),
    );
    expect(input[0]).toBe(tasks[5]);
  });

  it("ignores missing timestamps and breaks equal-time ties consistently", () => {
    expect(
      recentOperations([
        { id: "missing" },
        { id: "b", updatedAt: "2026-10-17T01:00:00.000Z" },
        { id: "invalid", updatedAt: "unknown" },
        { id: "a", updatedAt: "2026-10-17T01:00:00.000Z" },
      ]).map((task) => task.id),
    ).toEqual(["a", "b"]);
  });
});
