import { describe, it, expect } from "vitest";
import { chunkText, countTokens } from "../../src/ingest/chunk.js";

describe("countTokens", () => {
  it("returns positive integer for non-empty input", () => {
    expect(countTokens("hello world")).toBeGreaterThan(0);
  });
  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });
});

describe("chunkText", () => {
  it("returns single chunk when text fits in window", () => {
    const chunks = chunkText("short text", { maxTokens: 100, overlap: 10 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toBe("short text");
    expect(chunks[0]?.index).toBe(0);
  });

  it("splits long text into multiple chunks with overlap", () => {
    const long = Array.from({ length: 1000 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(long, { maxTokens: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(100);
      expect(c.tokenCount).toBeGreaterThan(0);
    }
    const lastWordsOfChunk0 = chunks[0]!.text.trim().split(/\s+/).slice(-5);
    const firstWordsOfChunk1 = chunks[1]!.text.trim().split(/\s+/).slice(0, 15);
    const overlapping = lastWordsOfChunk0.filter((w) =>
      firstWordsOfChunk1.includes(w),
    );
    expect(overlapping.length).toBeGreaterThan(0);
  });

  it("rejects invalid params", () => {
    expect(() => chunkText("x", { maxTokens: 0, overlap: 0 })).toThrow();
    expect(() => chunkText("x", { maxTokens: 100, overlap: 100 })).toThrow();
  });

  it("preserves chunk order with sequential index", () => {
    const long = Array.from({ length: 500 }, (_, i) => `t${i}`).join(" ");
    const chunks = chunkText(long, { maxTokens: 50, overlap: 10 });
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });
});
