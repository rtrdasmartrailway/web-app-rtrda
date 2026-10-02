import { readSurveySummary } from "@/lib/survey/google-sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Share a short-lived aggregate between viewers; do not re-refresh the broad
// OAuth credential for every anonymous page poll. Failed reads are never cached.
type Summary = Awaited<ReturnType<typeof readSurveySummary>>;
let cached: { value: Summary; until: number } | null = null;
let pending: Promise<Summary> | null = null;

async function currentSummary(path: string): Promise<Summary> {
  if (cached && Date.now() < cached.until) return cached.value;
  if (!pending) {
    pending = readSurveySummary(path)
      .then((value) => {
        cached = { value, until: Date.now() + 15_000 };
        return value;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

export async function GET(): Promise<Response> {
  const path = process.env.SURVEY_GOOGLE_TOKEN_FILE;
  if (!path) return unavailable();
  try {
    const summary = await currentSummary(path);
    return Response.json(summary, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // Never serialize upstream errors, sheet cells, paths, tokens, or respondent records.
    return unavailable();
  }
}

function unavailable() {
  return Response.json(
    { error: "ข้อมูลยังไม่พร้อมใช้งาน" },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
