import type { PrTaskStatus } from "./workflow";
export const OPERATION_COLUMNS: Array<[string, Array<Lowercase<PrTaskStatus>>]> = [
  ["New request", ["draft", "waiting_for_information"]],
  ["Planning", ["communication_planning"]],
  ["In production", ["in_production"]],
  [
    "Review",
    [
      "source_fact_check",
      "technical_review",
      "pr_editorial_review",
      "management_approval",
    ],
  ],
  ["Revision required", ["revision_required"]],
  ["Scheduled", ["approved", "scheduled", "published", "closed"]],
  ["Not proceeding", ["rejected", "cancelled"]],
];
