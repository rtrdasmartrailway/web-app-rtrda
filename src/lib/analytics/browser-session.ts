import { UUID } from "./activity-contract";
const WINDOW_MS = 30 * 60 * 1000;
const KEY = "rtrda_activity_session_v2";
let fallback: { id: string; at: number } | null = null;
export function browserSession(
  storage: Pick<Storage, "getItem" | "setItem">,
  now = Date.now(),
  uuid = () => crypto.randomUUID(),
): string {
  let session: { id: string; at: number } | null = fallback;
  try {
    session = JSON.parse(storage.getItem(KEY) || "null");
  } catch {
    /* Storage can be unavailable. */
  }
  if (
    !session ||
    !UUID.test(session.id) ||
    !Number.isFinite(session.at) ||
    now - session.at >= WINDOW_MS ||
    session.at > now
  )
    session = { id: uuid(), at: now };
  session.at = now;
  fallback = session;
  try {
    storage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* Keep an in-memory tab session. */
  }
  return session.id;
}
