const RTRDA_HOSTS = new Set(["www.rtrda.or.th", "rtrda.or.th"]);

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function stripHashAndSearch(value: string): string {
  const hashIndex = value.indexOf("#");
  const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const searchIndex = withoutHash.indexOf("?");
  return searchIndex >= 0 ? withoutHash.slice(0, searchIndex) : withoutHash;
}

export function normalizeRoutePath(value: string): string {
  const rawPath = stripHashAndSearch(value.trim());
  const pathOnly = rawPath === "" ? "/" : rawPath;
  const withLeadingSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  const segments = withLeadingSlash
    .split("/")
    .filter(Boolean)
    .map(decodeSegment);
  const normalized = `/${segments.join("/")}`;

  return normalized === "" ? "/" : normalized;
}

export function isRtrdaInternalUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return RTRDA_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getRtrdaPathFromUrl(value: string): string | null {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return normalizeRoutePath(value);
  }

  try {
    const parsed = new URL(value);
    if (!RTRDA_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }

    return normalizeRoutePath(parsed.pathname);
  } catch {
    return null;
  }
}

export function rewriteRtrdaUrl(value: string): string {
  const path = getRtrdaPathFromUrl(value);
  return path ?? value;
}
