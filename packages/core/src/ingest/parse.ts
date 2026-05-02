import { marked } from "marked";
import * as cheerio from "cheerio";

export interface ParsedDoc {
  title: string;
  text: string;
}

export function parseMarkdown(input: string): ParsedDoc {
  const tokens = marked.lexer(input);
  let title = "";
  const lines: string[] = [];

  for (const t of tokens) {
    if (t.type === "heading") {
      const h = t as { type: "heading"; text: string; depth: number };
      if (!title) title = h.text.trim();
      lines.push(h.text.trim());
    } else if (t.type === "paragraph") {
      const p = t as { type: "paragraph"; text: string };
      const stripped = stripMd(p.text);
      lines.push(stripped);
    } else if (t.type === "list") {
      const l = t as { type: "list"; items: { text: string }[] };
      for (const item of l.items) lines.push("- " + stripMd(item.text));
    } else if (t.type === "code") {
      const c = t as { type: "code"; text: string };
      lines.push(c.text);
    }
  }

  const text = lines.join("\n\n");
  if (!title) {
    const firstSentence = text.split(/[.!?]/)[0]?.trim() ?? "";
    title =
      firstSentence.length > 0
        ? firstSentence + (text.includes(".") ? "." : "")
        : "Untitled";
  }

  return { title, text };
}

function stripMd(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export function parseHtml(input: string): ParsedDoc {
  const $ = cheerio.load(input);
  $("script, style, nav, header, footer").remove();

  const root = $("article").length ? $("article") : $("body");

  const titleEl = root.find("h1").first();
  const title = (titleEl.text() || $("title").text() || "Untitled").trim();

  const blocks: string[] = [];
  root.find("h1, h2, h3, p, li").each((_, el) => {
    const t = $(el).text().trim();
    if (t) blocks.push(t);
  });

  return { title, text: blocks.join("\n\n") };
}
