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
  publishedUrl?: string | null;
  publishedReference?: string | null;
};

export type CalendarRequestDecision = {
  id: string;
  requestId: string;
  requestNumber: string;
  title: string;
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  actorName: string;
  date: string;
};

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function bangkokDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Date-only anchor whose UTC fields represent the Bangkok calendar date. */
export function bangkokCalendarAnchor(value: Date): Date {
  const shifted = new Date(value.getTime() + BANGKOK_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
  );
}

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
      ("publishedUrl" in entry &&
        !(entry.publishedUrl === null || typeof entry.publishedUrl === "string")) ||
      ("publishedReference" in entry &&
        !(
          entry.publishedReference === null ||
          typeof entry.publishedReference === "string"
        )) ||
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
      ...(typeof entry.publishedUrl === "string" || entry.publishedUrl === null
        ? { publishedUrl: entry.publishedUrl }
        : {}),
      ...(typeof entry.publishedReference === "string" ||
      entry.publishedReference === null
        ? { publishedReference: entry.publishedReference }
        : {}),
    };
  });
}

export function parseCalendarRequestDecisions(value: unknown): CalendarRequestDecision[] {
  if (!Array.isArray(value)) throw new Error("Invalid calendar decision response");
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.requestId !== "string" ||
      typeof entry.requestNumber !== "string" ||
      typeof entry.title !== "string" ||
      !["APPROVED", "REJECTED"].includes(String(entry.decision)) ||
      !(entry.reason === null || typeof entry.reason === "string") ||
      typeof entry.actorName !== "string" ||
      typeof entry.date !== "string" ||
      !Number.isFinite(Date.parse(entry.date))
    )
      throw new Error("Invalid calendar decision response");
    return {
      id: entry.id,
      requestId: entry.requestId,
      requestNumber: entry.requestNumber,
      title: entry.title,
      decision: entry.decision as CalendarRequestDecision["decision"],
      reason: entry.reason,
      actorName: entry.actorName,
      date: entry.date,
    };
  });
}
