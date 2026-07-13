import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageToggle } from "./language-toggle";
import { ReaderControls } from "./reader-controls";

describe("LanguageToggle", () => {
  it("marks TH active and links EN to the alternate path on Thai pages", () => {
    const html = renderToStaticMarkup(
      <LanguageToggle alternatePath="/en/คลังความรู้" language="th" />,
    );

    expect(html).toContain('aria-current="true"');
    expect(html).toContain(">TH</span>");
    expect(html).toContain('href="/en/คลังความรู้"');
    expect(html).toContain(">EN</a>");
  });

  it("marks EN active and links TH to the alternate path on English pages", () => {
    const html = renderToStaticMarkup(
      <LanguageToggle alternatePath="/คลังความรู้" language="en" />,
    );

    expect(html).toContain('aria-current="true"');
    expect(html).toContain(">EN</span>");
    expect(html).toContain('href="/คลังความรู้"');
    expect(html).toContain(">TH</a>");
  });
});

describe("ReaderControls", () => {
  it("renders localized footer font-size controls", () => {
    const html = renderToStaticMarkup(<ReaderControls language="th" />);

    expect(html).toContain("ขนาดตัวอักษร");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(">A</button>");
    expect(html).toContain(">AA</button>");
    expect(html).toContain(">AAA</button>");
  });
});
