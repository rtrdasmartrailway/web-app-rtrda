import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { INTRO_RETURN_COOKIE } from "@/lib/intro-flow";

describe("intro enter route", () => {
  it("sets a short-lived return marker and redirects to the Test homepage", () => {
    const response = GET(new Request("https://test.rtrda.or.th/intro/enter"));
    const cookie = response.headers.get("set-cookie")?.toLowerCase() ?? "";

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://test.rtrda.or.th/");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(cookie).toContain(`${INTRO_RETURN_COOKIE}=1`);
    expect(cookie).toContain("httponly");
    expect(cookie).toContain("secure");
    expect(cookie).toContain("samesite=lax");
    expect(cookie).toContain("max-age=60");
  });
});
