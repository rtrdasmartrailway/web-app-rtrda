import { TASK_TRANSITIONS, type PrTaskStatus } from "./workflow";

export const BOARD_COLUMNS = [
  "New request",
  "Planning",
  "In production",
  "Review",
  "Scheduled",
] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];
export type BoardMove =
  | { action: "transition"; status: PrTaskStatus }
  | { action: "schedule" }
  | { action: "blocked"; reason: "request" | "workflow" | "policy" };

export function boardMove(
  from: PrTaskStatus,
  requestStatus: string | undefined,
  column: BoardColumn,
  reviewEntry?: PrTaskStatus,
  freeMove = false,
): BoardMove {
  if (!(BOARD_COLUMNS as readonly string[]).includes(column))
    return { action: "blocked", reason: "workflow" };
  if (requestStatus !== "APPROVED") return { action: "blocked", reason: "request" };
  if (freeMove) {
    if (column === "Scheduled") return { action: "schedule" };
    return {
      action: "transition",
      status:
        column === "New request"
          ? "DRAFT"
          : column === "Planning"
            ? "COMMUNICATION_PLANNING"
            : column === "In production"
              ? "IN_PRODUCTION"
              : "SOURCE_FACT_CHECK",
    };
  }
  if (column === "Scheduled")
    return from === "APPROVED"
      ? { action: "schedule" }
      : { action: "blocked", reason: "workflow" };
  if (column === "Review" && !reviewEntry) return { action: "blocked", reason: "policy" };
  const target: PrTaskStatus =
    column === "New request"
      ? "WAITING_FOR_INFORMATION"
      : column === "Planning"
        ? "COMMUNICATION_PLANNING"
        : column === "In production"
          ? "IN_PRODUCTION"
          : reviewEntry!;
  if (
    (column === "Review" && !["IN_PRODUCTION", "REVISION_REQUIRED"].includes(from)) ||
    !(TASK_TRANSITIONS[from] as readonly string[]).includes(target)
  )
    return { action: "blocked", reason: "workflow" };
  return { action: "transition", status: target };
}
