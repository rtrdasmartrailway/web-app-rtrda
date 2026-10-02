import type { NextRequest } from "next/server";
import { middleware } from "@/lib/request-policy";
import { checkSurveyAccess, surveyPrivateHeaders } from "@/lib/survey/survey-private";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isSurvey = ["/rtrdaintranet/survey-dashboard", "/api/survey-dashboard"].some(
    (base) => path === base || path.startsWith(`${base}/`),
  );
  if (isSurvey) {
    const denied = await checkSurveyAccess(request.headers);
    if (denied) return denied;
  }
  const response = middleware(request);
  if (isSurvey) {
    for (const [key, value] of Object.entries(surveyPrivateHeaders))
      response.headers.set(key, value);
  }
  return response;
}
