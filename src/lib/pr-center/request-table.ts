const REQUEST_STATUS_PRIORITY = [
  "rejected",
  "revision_required",
  "waiting_for_information",
  "management_approval",
  "pr_editorial_review",
  "technical_review",
  "source_fact_check",
  "in_production",
  "communication_planning",
  "draft",
  "approved",
  "scheduled",
  "published",
  "closed",
  "cancelled",
] as const;

export type RequestTableStatus = (typeof REQUEST_STATUS_PRIORITY)[number];

export type RequestTableTask = {
  contentType: string;
  status: string;
};

export function summarizeRequestTableTasks(tasks: RequestTableTask[]) {
  const contentTypes = [
    ...new Set(tasks.map((task) => task.contentType.trim()).filter(Boolean)),
  ].slice(0, 3);
  const statuses = tasks.map((task) => task.status);

  let status: RequestTableStatus = "draft";
  if (statuses.length > 0) {
    if (statuses.every((item) => item === "closed")) status = "closed";
    else if (statuses.every((item) => ["published", "closed"].includes(item)))
      status = "published";
    else
      status = REQUEST_STATUS_PRIORITY.find((item) => statuses.includes(item)) ?? "draft";
  }

  return { count: tasks.length, contentTypes, status };
}
