import { expect, it } from "vitest";
import { OPERATION_COLUMNS } from "./operation-columns";
import { TASK_TRANSITIONS } from "./workflow";
it("renders every supported task status in exactly one Operations column", () => {
  const statuses = OPERATION_COLUMNS.flatMap(([, values]) => values);
  expect([...statuses].sort()).toEqual(
    Object.keys(TASK_TRANSITIONS)
      .map((status) => status.toLowerCase())
      .sort(),
  );
  expect(new Set(statuses).size).toBe(statuses.length);
});
