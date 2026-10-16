export type ExecutiveTaskStatus =
  | "draft"
  | "waiting_for_information"
  | "communication_planning"
  | "in_production"
  | "source_fact_check"
  | "technical_review"
  | "pr_editorial_review"
  | "management_approval"
  | "revision_required"
  | "approved"
  | "scheduled"
  | "published"
  | "closed"
  | "cancelled"
  | "rejected";

export type ExecutiveWorkflowCounts = {
  published: number;
  pending: number;
  planning: number;
  waiting: number;
  production: number;
  approved: number;
  scheduled: number;
  activeTasks: number;
  submittedRequests: number;
};

export function getExecutiveWorkflowCounts(
  tasks: readonly { status: ExecutiveTaskStatus }[],
  requests: readonly { status?: string }[],
): ExecutiveWorkflowCounts {
  return {
    published: tasks.filter((task) => ["published", "closed"].includes(task.status))
      .length,
    pending: tasks.filter((task) =>
      ["pr_editorial_review", "management_approval"].includes(task.status),
    ).length,
    planning: tasks.filter((task) =>
      ["draft", "communication_planning"].includes(task.status),
    ).length,
    waiting: tasks.filter((task) => task.status === "waiting_for_information").length,
    production: tasks.filter((task) =>
      ["in_production", "source_fact_check", "technical_review"].includes(task.status),
    ).length,
    approved: tasks.filter((task) => task.status === "approved").length,
    scheduled: tasks.filter((task) => task.status === "scheduled").length,
    activeTasks: tasks.filter(
      (task) => !["closed", "cancelled", "rejected", "published"].includes(task.status),
    ).length,
    submittedRequests: requests.filter((request) => request.status === "SUBMITTED")
      .length,
  };
}

export function createExecutiveOverviewExport(input: {
  generatedAt: Date;
  scopeLabel: string;
  counts: ExecutiveWorkflowCounts;
  totalRequests: number;
  totalTasks: number;
  unavailableReason: string;
}) {
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt.toISOString(),
    scope: input.scopeLabel,
    metrics: {
      published: input.counts.published,
      reach: null,
      interactions: null,
      engagementRate: null,
      unavailableReason: input.unavailableReason,
    },
    workflow: {
      planning: input.counts.planning,
      waiting: input.counts.waiting,
      production: input.counts.production,
      pending: input.counts.pending,
      approved: input.counts.approved,
      scheduled: input.counts.scheduled,
    },
    requests: {
      loaded: input.totalRequests,
      submitted: input.counts.submittedRequests,
    },
    tasksLoaded: input.totalTasks,
  };
}
