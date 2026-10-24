import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const state = vi.hoisted(() => ({
  path: "/ติดต่อเรา/ช่องทางการติดต่อ",
  blobs: [] as Blob[],
  listeners: new Map<string, (event: MouseEvent) => void>(),
  cleanups: [] as (() => void)[],
}));
vi.mock("react", () => ({
  useEffect: (callback: () => void | (() => void)) => {
    const cleanup = callback();
    if (cleanup) state.cleanups.push(cleanup);
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
import { WebAnalyticsTracker } from "./web-analytics-tracker";
class TestElement {
  anchor: TestAnchor | null = null;
  closest() {
    return this.anchor;
  }
}
class TestAnchor extends TestElement {
  constructor(readonly href: string) {
    super();
    this.anchor = this;
  }
}
const form =
  "https://docs.google.com/forms/d/e/1FAIpQLSd8nY4Dt-vjvl6Ag4Jnwq_Ko5zEUT7FgKH8DB-wql74KAVe5w/viewform?entry.1=secret";
beforeEach(() => {
  let storage: string | null = null;
  state.blobs = [];
  state.listeners.clear();
  state.cleanups = [];
  vi.stubGlobal("Element", TestElement);
  vi.stubGlobal("HTMLAnchorElement", TestAnchor);
  vi.stubGlobal("crypto", { randomUUID });
  vi.stubGlobal("sessionStorage", {
    getItem: () => storage,
    setItem: (_key: string, value: string) => {
      storage = value;
    },
  });
  vi.stubGlobal("document", {
    referrer: "",
    addEventListener: (name: string, listener: (event: MouseEvent) => void) =>
      state.listeners.set(name, listener),
    removeEventListener: (name: string) => state.listeners.delete(name),
  });
  vi.stubGlobal("location", {
    origin: "https://test.rtrda.or.th",
    href: "https://test.rtrda.or.th" + state.path,
    pathname: state.path,
  });
  vi.stubGlobal("navigator", {
    sendBeacon: vi.fn((_url: string, blob: Blob) => {
      state.blobs.push(blob);
      return true;
    }),
  });
  WebAnalyticsTracker();
  state.blobs = [];
});
afterEach(() => {
  for (const cleanup of state.cleanups) cleanup();
  vi.unstubAllGlobals();
});
function activation(type = "click", button = 0, url = form) {
  const target = new TestElement();
  target.anchor = new TestAnchor(url);
  return {
    type,
    button,
    target,
    detail: 0,
    ctrlKey: true,
    metaKey: true,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as MouseEvent;
}
describe("delegated outbound form activation", () => {
  it("captures nested styled buttons, keyboard/new-tab and middle clicks without changing navigation or duplicate listeners", async () => {
    const left = activation();
    state.listeners.get("click")!(left);
    state.listeners.get("click")!(left);
    const middle = activation(
      "auxclick",
      1,
      "https://forms.gle/cA3FjxyvkR1pKy5k6?private=secret",
    );
    state.listeners.get("auxclick")!(middle);
    state.listeners.get("click")!(activation("click", 1));
    state.listeners.get("auxclick")!(activation("auxclick", 2));
    const payloads = await Promise.all(
      state.blobs.map(async (blob) => JSON.parse(await blob.text())),
    );
    expect(payloads).toHaveLength(2);
    expect(payloads.map((event) => event.eventType)).toEqual([
      "outbound_form_click",
      "outbound_form_click",
    ]);
    expect(new Set(payloads.map((event) => event.eventId)).size).toBe(2);
    expect(JSON.stringify(payloads)).not.toContain("secret");
    expect(left.preventDefault).not.toHaveBeenCalled();
    expect(left.stopPropagation).not.toHaveBeenCalled();
  });
  it("uses nonblocking keepalive fallback with the same event ID when beacon refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({}));
    vi.mocked(navigator.sendBeacon).mockImplementation((_url, body) => {
      state.blobs.push(body as Blob);
      return false;
    });
    state.listeners.get("click")!(activation());
    const body = JSON.parse(await state.blobs[0].text());
    expect(fetch).toHaveBeenCalledWith(
      "/api/analytics/events",
      expect.objectContaining({ keepalive: true, body: JSON.stringify(body) }),
    );
  });
});
