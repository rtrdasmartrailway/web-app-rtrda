/**
 * Helpers for building the custom home-page sections from imported data.
 * The legacy WordPress home content is a set of blocks (latest-news,
 * latest-articles, calendar, partners); we replace the rendering with
 * purpose-built sections but still source some data (partner logos) from it.
 */

/**
 * Pull the partner-logo image paths out of the home content. They are the run
 * of uploaded images under the final heading (the partners section), so this
 * works regardless of the heading's language ("เครือข่ายพันธมิตร" / "Our
 * Partners").
 */
export function extractPartnerLogos(html: string): string[] {
  const lastHeading = String(html ?? "").lastIndexOf("<h2");
  const region = lastHeading >= 0 ? html.slice(lastHeading) : (html ?? "");
  const srcs = [
    ...region.matchAll(/<img[^>]*\bsrc="(\/wp-content\/uploads\/[^"]+)"/g),
  ].map((match) => match[1]);
  return Array.from(new Set(srcs));
}

/** The day (YYYY-MM-DD) an ISO date string falls on, without timezone shift. */
export function dayKey(isoDate: string): string {
  return String(isoDate ?? "").slice(0, 10);
}
