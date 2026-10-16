import {
  aggregatePlatformDistribution,
  parseCsv,
  type PlatformDistribution,
  type PlatformName,
  type PlatformPeriod,
} from "@/lib/pr-center/platform-distribution-data";

const SHEET_ID = "1HY-knJByL0Mt5Bl8AzIFZoxzlwUGObXzBUmrMFHI9AQ";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

export async function readPlatformDistribution(
  filters: {
    period?: PlatformPeriod;
    platform?: PlatformName;
  } = {},
): Promise<PlatformDistribution> {
  const response = await fetch(SHEET_CSV_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8" },
  });
  if (!response.ok) throw new Error("Platform spreadsheet is unavailable");
  const csv = await response.text();
  return aggregatePlatformDistribution(parseCsv(csv), new Date().toISOString(), filters);
}
