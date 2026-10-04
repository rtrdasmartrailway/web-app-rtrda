export type CalendarEntry = {
  id: string;
  taskId: string;
  title: string;
  requestNumber: string;
  channel: string | null;
  taskRevision: number | null;
  date: string;
  status: "SCHEDULED" | "PUBLISHED" | "DRAFT";
  contentType?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCalendarEntries(value: unknown): CalendarEntry[] {
  if (!Array.isArray(value)) throw new Error("Invalid calendar response");

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.taskId !== "string" ||
      typeof entry.title !== "string" ||
      typeof entry.requestNumber !== "string" ||
      !(entry.channel === null || typeof entry.channel === "string") ||
      !(
        entry.taskRevision === null ||
        (typeof entry.taskRevision === "number" && Number.isInteger(entry.taskRevision))
      ) ||
      typeof entry.date !== "string" ||
      !Number.isFinite(Date.parse(entry.date)) ||
      !["SCHEDULED", "PUBLISHED", "DRAFT"].includes(String(entry.status)) ||
      (entry.status === "DRAFT" && typeof entry.contentType !== "string") ||
      (entry.status !== "DRAFT" && typeof entry.channel !== "string")
    ) {
      throw new Error("Invalid calendar response");
    }

    return {
      id: entry.id,
      taskId: entry.taskId,
      title: entry.title,
      requestNumber: entry.requestNumber,
      channel: entry.channel,
      taskRevision: entry.taskRevision,
      date: entry.date,
      status: entry.status as CalendarEntry["status"],
      ...(typeof entry.contentType === "string"
        ? { contentType: entry.contentType }
        : {}),
    };
  });
}
