/** Canonical persisted submission fields, not the caller's transition payload. */
export type RequestSubmission = {
  type: unknown;
  title: unknown;
  requestedFor: unknown;
  sourceUrls: unknown;
  objective?: unknown;
  audience?: unknown;
  priorityReason?: unknown;
  details: unknown;
};

export class RequestSubmissionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

function invalid(message: string, code = "INVALID_REQUEST_DETAILS"): never {
  throw new RequestSubmissionError(message, code);
}

function text(value: unknown, field: string, max: number, required = false) {
  if (value === undefined || value === null) {
    if (required) invalid(`${field} is required`);
    return;
  }
  if (typeof value !== "string" || value.trim().length > max)
    invalid(`${field} must be at most ${max} characters`);
  if (required && !value.trim()) invalid(`${field} is required`);
}

/** Incomplete drafts remain supported; supplied fields must still be well formed. */
export function validateRequestDraftBounds(input: {
  objective?: unknown;
  audience?: unknown;
  priorityReason?: unknown;
  requestedFor?: unknown;
  sourceUrls: unknown;
}) {
  text(input.objective, "Objective", 5000);
  text(input.audience, "Audience", 5000);
  text(input.priorityReason, "Priority reason", 1000);
  if (
    input.requestedFor !== undefined &&
    input.requestedFor !== null &&
    (!(input.requestedFor instanceof Date) ||
      !Number.isFinite(input.requestedFor.getTime()))
  )
    invalid("A valid requested date is required", "INVALID_REQUESTED_DATE");
  if (
    !Array.isArray(input.sourceUrls) ||
    input.sourceUrls.length > 100 ||
    input.sourceUrls.some((url) => typeof url !== "string" || url.length > 2048)
  )
    invalid(
      "Source URLs must contain at most 100 URLs of 2048 characters",
      "INVALID_SOURCE_URL",
    );
}

export function validateRequestSubmission(
  input: RequestSubmission,
  allowedContentTypes: ReadonlySet<string>,
): void {
  if (input.type !== "PR" && input.type !== "OFFSITE")
    invalid("Unknown request type", "INVALID_REQUEST_TYPE");
  if (
    typeof input.title !== "string" ||
    input.title.trim().length < 3 ||
    input.title.trim().length > 300
  )
    invalid("Title must contain 3 to 300 characters", "INVALID_TITLE");
  validateRequestDraftBounds(input);
  if (
    !(input.requestedFor instanceof Date) ||
    !Number.isFinite(input.requestedFor.getTime())
  )
    invalid("A valid requested date is required", "INVALID_REQUESTED_DATE");
  if (!Array.isArray(input.sourceUrls) || input.sourceUrls.length === 0)
    invalid("At least one source URL is required", "INVALID_SOURCE_URL");
  for (const url of input.sourceUrls) {
    try {
      if (new URL(url).protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      invalid("A source URL must be a valid HTTPS URL", "INVALID_SOURCE_URL");
    }
  }
  if (!input.details || typeof input.details !== "object" || Array.isArray(input.details))
    invalid("Project owner, assigner, and source confirmation are required");
  const details = input.details as Record<string, unknown>;
  text(details.projectOwner, "Project owner", 200, true);
  text(details.assigner, "Assigner", 200, true);
  if (details.confirmed !== true) invalid("Source confirmation is required");
  text(details.whyNow, "Why-now", 5000, input.type === "PR");
  text(details.priorityReason, "Priority reason", 1000);
  text(details.projectDetails, "Project details", 5000);
  const contentTypes = details.contentTypes;
  if (
    (input.type === "PR" && (!Array.isArray(contentTypes) || !contentTypes.length)) ||
    (contentTypes !== undefined &&
      (!Array.isArray(contentTypes) ||
        contentTypes.length > 100 ||
        contentTypes.some(
          (item) => typeof item !== "string" || !allowedContentTypes.has(item.trim()),
        )))
  )
    invalid("Select valid content types from the current master data");
  if (input.type === "PR") {
    text(input.objective, "Objective", 5000, true);
    text(input.audience, "Audience", 5000, true);
  } else {
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (
      typeof details.startTime !== "string" ||
      !time.test(details.startTime.trim()) ||
      typeof details.endTime !== "string" ||
      !time.test(details.endTime.trim()) ||
      details.endTime.trim() <= details.startTime.trim() ||
      typeof details.travel !== "string" ||
      !details.travel.trim() ||
      details.travel.trim().length > 200
    )
      invalid(
        "Valid off-site start/end times and travel arrangement are required",
        "INVALID_OFFSITE_DETAILS",
      );
  }
}
