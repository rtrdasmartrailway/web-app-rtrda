export const PLATFORM_NAMES = [
  "Facebook",
  "Website",
  "Press Release",
  "YouTube",
  "LinkedIn",
  "Internal",
  "TikTok",
] as const;

export type PlatformName = (typeof PLATFORM_NAMES)[number];
export type PlatformMetric = "posts" | "viewers" | "comments";
export type PlatformPeriod = "all" | "7" | "30" | "90";

export type PlatformDistribution = {
  fetchedAt: string;
  sampleData: boolean;
  recordCount: number;
  unclassifiedRows: number;
  totals: { posts: number; viewers: number; comments: number };
  platforms: Array<{
    name: PlatformName;
    posts: number;
    viewers: number;
    comments: number;
  }>;
};

const REQUIRED_HEADERS = ["หัวข้อ", "ผู้ชม", "คอมเม้น", "วัน/เดือน/ปี"] as const;

function sheetDate(value: string): number | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = Date.UTC(year, month - 1, day);
  const parsed = new Date(date);
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? date
    : null;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  if (quoted) throw new Error("Invalid CSV data");
  return rows;
}

function parseMetric(value: string | undefined): number {
  const normalized = value?.trim().replaceAll(",", "") ?? "";
  if (!normalized) return 0;
  if (!/^\d+(?:\.\d+)?$/.test(normalized))
    throw new Error("Invalid numeric value in platform spreadsheet");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed))
    throw new Error("Invalid numeric value in platform spreadsheet");
  return parsed;
}

export function aggregatePlatformDistribution(
  rows: readonly (readonly string[])[],
  fetchedAt = new Date().toISOString(),
  filters: { period?: PlatformPeriod; platform?: PlatformName } = {},
): PlatformDistribution {
  const header = rows[0]?.map((value, index) =>
    index === 0 ? value.replace(/^\uFEFF/, "").trim() : value.trim(),
  );
  if (!header?.length) throw new Error("Platform spreadsheet has no header row");
  const indexes = REQUIRED_HEADERS.map((name) => header.indexOf(name));
  if (indexes.some((index) => index < 0))
    throw new Error("Platform spreadsheet headers do not match the input template");

  const platformIndex = indexes[0]!;
  const viewersIndex = indexes[1]!;
  const commentsIndex = indexes[2]!;
  const dateIndex = indexes[3]!;
  const period = filters.period ?? "all";
  const today = new Date(new Date(fetchedAt).getTime() + 7 * 60 * 60 * 1000);
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const totals = { posts: 0, viewers: 0, comments: 0 };
  const byPlatform = new Map<PlatformName, PlatformDistribution["platforms"][number]>(
    PLATFORM_NAMES.map((name) => [name, { name, posts: 0, viewers: 0, comments: 0 }]),
  );
  let recordCount = 0;
  let unclassifiedRows = 0;

  for (const row of rows.slice(1)) {
    const platformText = row[platformIndex]?.trim() ?? "";
    const hasMetrics = [viewersIndex, commentsIndex].some((index) =>
      Boolean(row[index]?.trim()),
    );
    if (!platformText && !hasMetrics && !row[dateIndex]?.trim()) continue;
    if (period !== "all") {
      const date = sheetDate(row[dateIndex] ?? "");
      if (
        date === null ||
        date < todayUtc - (Number(period) - 1) * 86_400_000 ||
        date > todayUtc
      )
        continue;
    }
    if (filters.platform && platformText !== filters.platform) continue;
    const platform = PLATFORM_NAMES.find((name) => name === platformText);
    if (!platform) {
      unclassifiedRows += 1;
      continue;
    }

    const posts = 1;
    const viewers = parseMetric(row[viewersIndex]);
    const comments = parseMetric(row[commentsIndex]);
    const bucket = byPlatform.get(platform)!;
    bucket.posts += posts;
    bucket.viewers += viewers;
    bucket.comments += comments;
    totals.posts += posts;
    totals.viewers += viewers;
    totals.comments += comments;
    recordCount += 1;
  }

  return {
    fetchedAt,
    sampleData: header.some((value) => value.includes("ข้อมูลตัวอย่างสมมติ")),
    recordCount,
    unclassifiedRows,
    totals,
    platforms: [...byPlatform.values()],
  };
}
