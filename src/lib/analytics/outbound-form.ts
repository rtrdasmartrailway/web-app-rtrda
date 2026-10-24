/** Public responder identities only. Never retain queries, fragments, answers or edit links. */
export function outboundFormTarget(value: string | URL): string | null {
  let url: URL;
  try {
    url = new URL(String(value));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (host === "forms.gle") {
    const match = /^\/([A-Za-z0-9_-]{6,128})\/?$/.exec(url.pathname);
    return match ? `/outbound-form/short/${match[1]}` : null;
  }
  if (host !== "docs.google.com") return null;
  const published =
    /^\/forms\/(?:u\/\d+\/)?d\/e\/(1FA[A-Za-z0-9_-]{8,240})\/viewform\/?$/.exec(
      url.pathname,
    );
  if (published) return `/outbound-form/published/${published[1]}`;
  const legacy = /^\/forms\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{8,240})\/viewform\/?$/.exec(
    url.pathname,
  );
  return legacy ? `/outbound-form/legacy/${legacy[1]}` : null;
}

export function validatedFormTarget(value: unknown): string | null {
  return typeof value === "string" &&
    /^\/outbound-form\/(?:published|legacy|short)\/[A-Za-z0-9_-]{6,256}$/.test(value)
    ? value
    : null;
}

/** Staff-portal form links are allowed without enabling general private-page analytics. */
export function outboundSourceAllowed(path: string): boolean {
  const source = path.replace(/\/$/, "").replace(/^\/en(?=\/)/, "");
  if (
    [
      "/rtrdaintranet",
      "/rtrdaintranet/blog",
      "/rtrdaintranet/schedule-van",
      "/rtrdaintranet/vice-president",
      "/rtrdaintranet/survey-dashboard",
      "/rtrdaintranet/activity-log",
    ].includes(source)
  )
    return true;
  return ![
    "/api",
    "/_next",
    "/auth",
    "/healthz",
    "/logged-files-internal",
    "/pr-center-internal",
    "/rtrdaintranet",
  ].some((base) => source === base || source.startsWith(`${base}/`));
}

export function supportedActivation(event: Pick<MouseEvent, "type" | "button">): boolean {
  return (
    (event.type === "click" && event.button === 0) ||
    (event.type === "auxclick" && event.button === 1)
  );
}
