import { describe, expect, it } from "vitest";
import {
  outboundFormTarget,
  outboundSourceAllowed,
  supportedActivation,
  validatedFormTarget,
} from "./outbound-form";
import { storedFormTarget } from "./activity-store";
import { parseAnalyticsEvent } from "./event-contract";
import { reportFilter, reportWhere } from "./activity-report";

const contact =
  "https://docs.google.com/forms/d/e/1FAIpQLSd8nY4Dt-vjvl6Ag4Jnwq_Ko5zEUT7FgKH8DB-wql74KAVe5w/viewform";
const event = {
  eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  eventType: "outbound_form_click",
  path: "/ติดต่อเรา/ช่องทางการติดต่อ?private=not-retained",
  targetPath: outboundFormTarget(contact),
  source: "direct",
};
describe("outbound form evidence", () => {
  it("extracts responder identifiers only and drops prefill/auth query values and fragments", () => {
    const target = outboundFormTarget(
      contact + "?entry.123=private-answer&authuser=private#secret",
    );
    expect(target).toBe(outboundFormTarget(contact));
    expect(JSON.stringify(target)).not.toMatch(/private|entry|authuser|secret/);
    const key = storedFormTarget(target);
    expect(key).toMatch(/^\/outbound-form\/published\/[a-f0-9]{32}$/);
    expect(key).toBe(storedFormTarget(outboundFormTarget(contact)));
    expect(key).not.toContain("1FAIp");
    expect(outboundFormTarget("https://forms.gle/cA3FjxyvkR1pKy5k6?entry.1=secret")).toBe(
      "/outbound-form/short/cA3FjxyvkR1pKy5k6",
    );
    expect(
      outboundFormTarget("https://docs.google.com/forms/d/legacy12345/viewform?usp=test"),
    ).toBe("/outbound-form/legacy/legacy12345");
  });
  it("does not track other third parties, editor/response endpoints, credentials or lookalike hosts", () => {
    for (const url of [
      contact.replace("https:", "http:"),
      contact.replace("docs.google.com", "docs.google.com.evil.test"),
      contact.replace("viewform", "edit"),
      contact.replace("viewform", "formResponse"),
      contact.replace("docs.google.com", "user:password@docs.google.com"),
      "https://docs.google.com/spreadsheets/d/example/edit",
      "https://forms.gle/abc/path",
      "https://evil.test/forms",
    ])
      expect(outboundFormTarget(url)).toBeNull();
    expect(validatedFormTarget(event.targetPath + "?entry.1=secret")).toBeNull();
  });
  it("allows the requested staff portal form links but keeps general private/admin activity excluded", () => {
    for (const source of [
      "/rtrdaintranet",
      "/rtrdaintranet/blog",
      "/rtrdaintranet/schedule-van",
      "/ช่องทางการแจ้งเรื่องร้",
      "/en/e-services",
    ])
      expect(outboundSourceAllowed(source)).toBe(true);
    for (const source of [
      "/api/pr-center/session",
      "/rtrdaintranet/prcenter",
      "/rtrdaintranet/prcenter/requests/private",
      "/pr-center-internal",
      "/auth/callback",
    ])
      expect(outboundSourceAllowed(source)).toBe(false);
    expect(parseAnalyticsEvent({ ...event, path: "/rtrdaintranet" })).toMatchObject({
      eventType: "outbound_form_click",
    });
    expect(
      parseAnalyticsEvent({ ...event, eventType: "page_view", path: "/rtrdaintranet" }),
    ).toBeNull();
    expect(parseAnalyticsEvent({ ...event, path: "/rtrdaintranet/prcenter" })).toBeNull();
  });
  it("counts left/keyboard clicks and middle-click aux events once, without right-click duplication", () => {
    expect(supportedActivation({ type: "click", button: 0 })).toBe(true);
    expect(supportedActivation({ type: "auxclick", button: 1 })).toBe(true);
    expect(supportedActivation({ type: "click", button: 1 })).toBe(false);
    expect(supportedActivation({ type: "auxclick", button: 2 })).toBe(false);
  });
  it("supports parameterized pseudonymous journey filters without accepting identity or arbitrary input", () => {
    const filter = reportFilter(
      new URLSearchParams({ session: "abcdef0123456789", visitor: "0123456789abcdef" }),
    );
    expect(reportWhere(filter).values).toContain("abcdef0123456789");
    expect(reportWhere(filter).sql).not.toContain("abcdef0123456789");
    for (const params of [{ session: "person@example.test" }, { visitor: "' OR 1=1 --" }])
      expect(() =>
        reportFilter(
          new URLSearchParams(
            Object.entries(params).map(([key, value]) => [key, String(value)]),
          ),
        ),
      ).toThrow();
  });
});
