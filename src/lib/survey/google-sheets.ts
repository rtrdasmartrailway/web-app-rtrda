import { readFile } from "node:fs/promises";
import { aggregateSurvey } from "./survey-aggregate";

const SHEET_ID = "17P4RsoaxrtUb2HnxCNGK5q1bULm1lvYeXCPWSkr3azU";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const RANGE = "'Form Responses 1'!A:BU";

function credential(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function readSurveyValues(tokenFile: string): Promise<string[][]> {
  if (!tokenFile.startsWith("/") || !tokenFile.trim())
    throw new Error("Invalid survey configuration");
  const token = JSON.parse(await readFile(tokenFile, "utf8"));
  const clientId = credential(token.client_id);
  const clientSecret = credential(token.client_secret);
  const refreshToken = credential(token.refresh_token);
  if (!clientId || !clientSecret || !refreshToken || token.token_uri !== TOKEN_ENDPOINT)
    throw new Error("Invalid survey configuration");

  const refreshed = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!refreshed.ok) throw new Error("Survey token refresh failed");
  const accessToken = credential((await refreshed.json()).access_token);
  if (!accessToken) throw new Error("Survey token refresh failed");

  const values = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?valueRenderOption=FORMATTED_VALUE`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!values.ok) throw new Error("Survey sheet read failed");
  const data: unknown = await values.json();
  if (
    !data ||
    typeof data !== "object" ||
    !("values" in data) ||
    !Array.isArray(data.values)
  )
    throw new Error("Invalid survey sheet response");
  if (
    !data.values.every(
      (row) =>
        Array.isArray(row) && row.every((cell: unknown) => typeof cell === "string"),
    )
  )
    throw new Error("Invalid survey sheet response");
  return data.values as string[][];
}

export async function readSurveySummary(tokenFile: string) {
  return aggregateSurvey(await readSurveyValues(tokenFile), new Date().toISOString());
}

export async function readSurveyData(tokenFile: string) {
  const values = await readSurveyValues(tokenFile);
  const headers = Array.from({ length: 73 }, (_, index) => values[0]?.[index] ?? "");
  const responses = values
    .slice(1)
    .map((cells, index) => ({
      sheetRow: index + 2,
      cells: headers.map((_, column) => cells[column] ?? ""),
    }))
    .filter(({ cells }) => cells.some((cell) => cell.trim()));
  return {
    summary: aggregateSurvey(values, new Date().toISOString()),
    headers,
    responses,
  };
}

export type SurveyData = Awaited<ReturnType<typeof readSurveyData>>;
