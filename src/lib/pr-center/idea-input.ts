export type CreateContentIdeaInput = {
  title: string;
  rationale: string;
  audience?: string;
  pillar?: string;
  channel?: string;
  priority?: string;
  campaign?: string;
  evidenceUrls: string[];
};

const OPTIONAL_TEXT_LIMITS = {
  audience: 500,
  pillar: 100,
  channel: 100,
  priority: 40,
  campaign: 200,
} as const;

function requiredText(
  input: Record<string, unknown>,
  field: "title" | "rationale",
  max: number,
) {
  const value = input[field];
  if (typeof value !== "string") {
    throw new Error(`Idea ${field} must contain 3 to ${max} characters`);
  }
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > max) {
    throw new Error(`Idea ${field} must contain 3 to ${max} characters`);
  }
  return trimmed;
}

export function normalizeCreateIdeaInput(value: unknown): CreateContentIdeaInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Idea input must be an object");
  }
  const input = value as Record<string, unknown>;
  const normalized: CreateContentIdeaInput = {
    title: requiredText(input, "title", 300),
    rationale: requiredText(input, "rationale", 5000),
    evidenceUrls: [],
  };

  for (const [field, maximum] of Object.entries(OPTIONAL_TEXT_LIMITS) as Array<
    [keyof typeof OPTIONAL_TEXT_LIMITS, number]
  >) {
    const raw = input[field];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") throw new Error(`Idea ${field} must be text`);
    const trimmed = raw.trim();
    if (trimmed.length > maximum) {
      throw new Error(`Idea ${field} must contain at most ${maximum} characters`);
    }
    if (trimmed) normalized[field] = trimmed;
  }

  const evidence = input.evidenceUrls;
  if (evidence === undefined || evidence === null) return normalized;
  if (!Array.isArray(evidence))
    throw new Error("Idea evidence must be a list of HTTPS URLs");
  if (evidence.length > 20)
    throw new Error("An idea may include at most 20 evidence URLs");
  for (const rawUrl of evidence) {
    if (typeof rawUrl !== "string") {
      throw new Error("Idea evidence must be a list of HTTPS URLs");
    }
    const trimmed = rawUrl.trim();
    if (!trimmed) continue;
    if (trimmed.length > 2048) {
      throw new Error("Idea evidence URLs must be valid HTTPS URLs without credentials");
    }
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error();
      normalized.evidenceUrls.push(url.toString());
    } catch {
      throw new Error("Idea evidence URLs must be valid HTTPS URLs without credentials");
    }
  }
  return normalized;
}
