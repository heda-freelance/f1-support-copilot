import { describe, it, expect } from "vitest";
import { parseMarkdown, parseHtml } from "../../src/ingest/parse.js";

describe("parseMarkdown", () => {
  it("strips formatting and keeps headings as text", () => {
    const out = parseMarkdown("# Title\n\nHello **world**.");
    expect(out.title).toBe("Title");
    expect(out.text).toBe("Title\n\nHello world.");
  });

  it("falls back to first sentence when no heading", () => {
    const out = parseMarkdown("Just one line of help text.");
    expect(out.title).toBe("Just one line of help text.");
    expect(out.text).toBe("Just one line of help text.");
  });

  it("preserves inline code as plain text", () => {
    const out = parseMarkdown("Run `npm install` to set up.");
    expect(out.text).toContain("npm install");
  });
});

describe("parseHtml", () => {
  it("extracts text from <article>", () => {
    const html = `<html><head><title>Setup</title></head><body><nav>SKIP</nav><article><h1>Setup</h1><p>Step one.</p></article></body></html>`;
    const out = parseHtml(html);
    expect(out.title).toBe("Setup");
    expect(out.text).toBe("Setup\n\nStep one.");
  });

  it("falls back to <body> when no article", () => {
    const html = `<html><body><h1>FAQ</h1><p>Answer.</p></body></html>`;
    const out = parseHtml(html);
    expect(out.title).toBe("FAQ");
    expect(out.text).toContain("Answer.");
  });

  it("removes script and style", () => {
    const html = `<html><body><script>bad()</script><style>x{}</style><p>Visible</p></body></html>`;
    const out = parseHtml(html);
    expect(out.text).toBe("Visible");
  });
});
