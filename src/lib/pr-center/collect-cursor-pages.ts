// The PR Center list endpoints return one extra row as a has-more sentinel.
// Only the first `take` rows belong to each rendered page. Cursor from the
// last included row so the sentinel becomes the first row of the next page.
export async function collectCursorPages<T extends { id: string }>(
  loadPage: (cursor?: string) => Promise<T[]>,
  take = 100,
): Promise<T[]> {
  const records: T[] = [];
  let cursor: string | undefined;
  while (true) {
    const page = await loadPage(cursor);
    if (page.length > take + 1) throw new Error("Invalid request page size");
    const included = page.slice(0, take);
    records.push(...included);
    if (page.length <= take) return records;
    const next = included.at(-1)?.id;
    if (!next || next === cursor) throw new Error("Request pagination did not advance");
    cursor = next;
  }
}
