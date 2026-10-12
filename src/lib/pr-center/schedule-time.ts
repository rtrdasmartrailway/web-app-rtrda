const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIMEZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;
const BANGKOK_OFFSET_MINUTES = 7 * 60;

/** Convert a datetime-local control value, interpreted as Asia/Bangkok wall time, to UTC ISO. */
export function bangkokLocalDateTimeToISOString(value: string): string | null {
  if (!DATETIME_LOCAL_PATTERN.test(value)) return null;

  const timestamp = Date.parse(`${value}:00+07:00`);
  if (!Number.isFinite(timestamp)) return null;

  const roundTrip = new Date(timestamp + BANGKOK_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 16);
  if (roundTrip !== value) return null;

  return new Date(timestamp).toISOString();
}

/** Parse an absolute schedule timestamp; timezone-less values are intentionally rejected. */
export function parseAbsoluteScheduleDate(value: unknown): Date {
  if (typeof value !== "string" || !TIMEZONE_SUFFIX_PATTERN.test(value))
    return new Date(Number.NaN);
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(Number.NaN);
}
