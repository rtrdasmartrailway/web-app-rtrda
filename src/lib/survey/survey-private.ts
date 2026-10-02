import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function denied(status: 401 | 503): Response {
  return new Response(
    status === 401 ? "Authentication required" : "Service unavailable",
    {
      status,
      headers: {
        ...headers,
        ...(status === 401
          ? { "WWW-Authenticate": 'Basic realm="RTRDA Survey", charset="UTF-8"' }
          : {}),
      },
    },
  );
}

export async function checkSurveyAccess(
  requestHeaders: Headers,
): Promise<Response | null> {
  const path = process.env.SURVEY_DASHBOARD_PASSWORD_FILE;
  if (!path?.startsWith("/")) return denied(503);
  let password: string;
  try {
    password = (await readFile(path, "utf8")).replace(/\r?\n$/, "");
  } catch {
    return denied(503);
  }
  if (!password || password.length < 24) return denied(503);
  const authorization = requestHeaders.get("authorization") ?? "";
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(authorization);
  if (!match || match[1].length > 4096) return denied(401);
  const encoded = match[1];
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) return denied(401);
  const decoded = bytes.toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return denied(401);
  const supplied = decoded.slice(separator + 1);
  const expectedDigest = createHash("sha256").update(`rtrda-report:${password}`).digest();
  const suppliedDigest = createHash("sha256")
    .update(`${decoded.slice(0, separator)}:${supplied}`)
    .digest();
  return timingSafeEqual(expectedDigest, suppliedDigest) ? null : denied(401);
}

export const surveyPrivateHeaders = headers;
