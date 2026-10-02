import { readSurveyData } from "@/lib/survey/google-sheets";
import { checkSurveyAccess, surveyPrivateHeaders } from "@/lib/survey/survey-private";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const denied = await checkSurveyAccess(request.headers);
  if (denied) return denied;
  const path = process.env.SURVEY_GOOGLE_TOKEN_FILE;
  if (!path) return unavailable();
  try {
    const data = await readSurveyData(path);
    return Response.json(data, { headers: surveyPrivateHeaders });
  } catch {
    // Never serialize upstream errors, sheet cells, paths, tokens, or respondent records.
    return unavailable();
  }
}

function unavailable() {
  return Response.json(
    { error: "ข้อมูลยังไม่พร้อมใช้งาน" },
    { status: 503, headers: surveyPrivateHeaders },
  );
}
