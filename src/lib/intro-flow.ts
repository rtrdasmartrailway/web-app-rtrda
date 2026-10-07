export const INTRO_RETURN_COOKIE = "rtrda-intro-return";

const PUBLIC_HOSTS = new Set(["rtrda.or.th", "www.rtrda.or.th", "test.rtrda.or.th"]);

function publicHost(value: string | null): string | null {
  const host = value?.split(",")[0]?.trim().toLowerCase().split(":")[0];
  return host && PUBLIC_HOSTS.has(host) ? host : null;
}

export function introHomepageUrl(request: Request): URL {
  const requestUrl = new URL(request.url);
  const host =
    publicHost(request.headers.get("host")) ??
    publicHost(request.headers.get("x-forwarded-host")) ??
    publicHost(requestUrl.hostname);
  if (host) return new URL("https://" + host + "/");
  if (["localhost", "127.0.0.1"].includes(requestUrl.hostname)) {
    return new URL("/", requestUrl);
  }
  return new URL("https://www.rtrda.or.th/");
}
