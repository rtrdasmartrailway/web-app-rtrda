export const RELEASE_EVIDENCE_GATES = [
  "AUTHENTICATED_UAT",
  "BACKUP_RESTORE",
  "SECURITY_UAT",
  "GO_LIVE_SIGNOFF",
] as const;

export type ReleaseEvidenceGate = (typeof RELEASE_EVIDENCE_GATES)[number];
export type ReleaseEvidenceResult = "PASSED" | "FAILED";

export type ReleaseEvidenceInput = {
  gateKey: ReleaseEvidenceGate;
  result: ReleaseEvidenceResult;
  evidenceReference: string;
  notes: string | null;
  performedAt: Date;
};

export function parseReleaseEvidenceInput(
  value: Record<string, unknown>,
  now = new Date(),
): ReleaseEvidenceInput {
  if (
    typeof value.gateKey !== "string" ||
    !RELEASE_EVIDENCE_GATES.includes(value.gateKey as ReleaseEvidenceGate)
  )
    throw new Error("Release evidence gate is invalid");
  if (value.result !== "PASSED" && value.result !== "FAILED")
    throw new Error("Release evidence result is invalid");
  if (typeof value.evidenceReference !== "string")
    throw new Error("Evidence reference is required");
  const evidenceReference = value.evidenceReference.trim();
  if (evidenceReference.length < 3 || evidenceReference.length > 800)
    throw new Error("Evidence reference must contain 3 to 800 characters");
  const notes = typeof value.notes === "string" ? value.notes.trim() : "";
  if (notes.length > 2000) throw new Error("Evidence notes are too long");
  if (typeof value.performedAt !== "string" || !value.performedAt.trim())
    throw new Error("Evidence date is required");
  const performedAt = new Date(value.performedAt);
  if (!Number.isFinite(performedAt.getTime()) || performedAt > now)
    throw new Error("Evidence date must be valid and cannot be in the future");
  return {
    gateKey: value.gateKey as ReleaseEvidenceGate,
    result: value.result,
    evidenceReference,
    notes: notes || null,
    performedAt,
  };
}

export function latestReleaseEvidenceByGate<T extends { gateKey: string }>(
  records: readonly T[],
): Partial<Record<ReleaseEvidenceGate, T>> {
  const latest: Partial<Record<ReleaseEvidenceGate, T>> = {};
  for (const record of records) {
    if (
      RELEASE_EVIDENCE_GATES.includes(record.gateKey as ReleaseEvidenceGate) &&
      !latest[record.gateKey as ReleaseEvidenceGate]
    )
      latest[record.gateKey as ReleaseEvidenceGate] = record;
  }
  return latest;
}
