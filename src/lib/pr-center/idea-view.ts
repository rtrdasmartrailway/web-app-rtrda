export type IdeaListRecord = {
  id: string;
  title: string;
  rationale: string;
  proposerId: string;
  audience: string | null;
  pillar: string | null;
  channel: string | null;
  priority: string | null;
  campaign: string | null;
  evidenceUrls: string[];
  status:
    | "PROPOSED"
    | "UNDER_REVIEW"
    | "PENDING_APPROVAL"
    | "REVISION_REQUIRED"
    | "ACCEPTED"
    | "REJECTED"
    | "CONVERTED"
    | "ARCHIVED";
  decisionReason: string | null;
  createdAt: string;
  convertedRequestId: string | null;
  version: number;
};

export type IdeaListPage = {
  items: IdeaListRecord[];
  nextOffset: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const statuses = [
  "PROPOSED",
  "UNDER_REVIEW",
  "PENDING_APPROVAL",
  "REVISION_REQUIRED",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
  "ARCHIVED",
];

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseIdea(value: unknown): IdeaListRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.rationale !== "string" ||
    typeof value.proposerId !== "string" ||
    !nullableString(value.audience) ||
    !nullableString(value.pillar) ||
    !nullableString(value.channel) ||
    !nullableString(value.priority) ||
    !nullableString(value.campaign) ||
    !Array.isArray(value.evidenceUrls) ||
    !value.evidenceUrls.every((url) => typeof url === "string") ||
    !statuses.includes(String(value.status)) ||
    !nullableString(value.decisionReason) ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !nullableString(value.convertedRequestId) ||
    typeof value.version !== "number" ||
    !Number.isInteger(value.version) ||
    value.version < 1
  ) {
    throw new Error("Invalid Content Ideas list response");
  }

  return {
    id: value.id,
    title: value.title,
    rationale: value.rationale,
    proposerId: value.proposerId,
    audience: value.audience,
    pillar: value.pillar,
    channel: value.channel,
    priority: value.priority,
    campaign: value.campaign,
    evidenceUrls: value.evidenceUrls,
    status: value.status as IdeaListRecord["status"],
    decisionReason: value.decisionReason,
    createdAt: value.createdAt,
    convertedRequestId: value.convertedRequestId,
    version: value.version,
  };
}

export function parseIdeaListPage(value: unknown): IdeaListPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !(
      value.nextOffset === null ||
      (typeof value.nextOffset === "number" &&
        Number.isSafeInteger(value.nextOffset) &&
        value.nextOffset >= 0)
    )
  ) {
    throw new Error("Invalid Content Ideas list response");
  }
  return { items: value.items.map(parseIdea), nextOffset: value.nextOffset };
}
