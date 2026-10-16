type UpdatedOperation = { id: string; updatedAt?: string | null };

/** Use the task's persisted update time, not the request's creation or due date. */
export function recentOperations<T extends UpdatedOperation>(tasks: readonly T[]): T[] {
  return tasks
    .filter((task) => task.updatedAt && Number.isFinite(Date.parse(task.updatedAt)))
    .sort(
      (a, b) =>
        Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!) || a.id.localeCompare(b.id),
    )
    .slice(0, 10);
}
