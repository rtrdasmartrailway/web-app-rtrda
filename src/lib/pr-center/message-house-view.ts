export type CurrentMessageHouse = {
  versionNumber: number;
  vision: string;
  positioning: string;
  pillars: string[];
  foundation: string;
  effectiveAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCurrentMessageHouse(value: unknown): CurrentMessageHouse | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error("Invalid current Message House response");

  const { versionNumber, vision, positioning, pillars, foundation, effectiveAt } = value;
  if (
    typeof versionNumber !== "number" ||
    !Number.isInteger(versionNumber) ||
    versionNumber < 1 ||
    typeof vision !== "string" ||
    typeof positioning !== "string" ||
    typeof foundation !== "string" ||
    !Array.isArray(pillars) ||
    !pillars.every((pillar): pillar is string => typeof pillar === "string") ||
    typeof effectiveAt !== "string" ||
    !Number.isFinite(Date.parse(effectiveAt))
  ) {
    throw new Error("Invalid current Message House response");
  }

  return { versionNumber, vision, positioning, pillars, foundation, effectiveAt };
}

export function parseMessageHouseHistory(value: unknown): CurrentMessageHouse[] {
  if (!Array.isArray(value)) throw new Error("Invalid Message House history response");
  return value.map((version) => {
    try {
      const parsed = parseCurrentMessageHouse(version);
      if (!parsed) throw new Error("Missing version");
      return parsed;
    } catch {
      throw new Error("Invalid Message House history response");
    }
  });
}
