import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildLocalProvider } from "../../src/providers/local.js";

const cfg = {
  llmUrl: "http://x/v1",
  embedUrl: "http://e",
  rerankUrl: "http://r",
  embedDim: 768,
  llmModel: "default",
};

const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn() as any;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("local embed", () => {
  it("calls TEI /embed with the inputs", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
    });
    const p = buildLocalProvider(cfg);
    const out = await p.embed.embed(["a", "b"]);
    expect(out).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    const call = (globalThis.fetch as any).mock.calls[0];
    expect(call[0]).toBe("http://e/embed");
    expect(JSON.parse(call[1].body).inputs).toEqual(["a", "b"]);
  });

  it("short-circuits on empty input", async () => {
    const p = buildLocalProvider(cfg);
    expect(await p.embed.embed([])).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("reports configured dimensions", () => {
    const p = buildLocalProvider(cfg);
    expect(p.embed.dimensions()).toBe(768);
  });

  it("throws on non-ok response", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const p = buildLocalProvider(cfg);
    await expect(p.embed.embed(["a"])).rejects.toThrow("tei embed: 500");
  });
});

describe("local rerank", () => {
  it("calls TEI /rerank and reorders", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [
        { index: 1, score: 0.9 },
        { index: 0, score: 0.2 },
      ],
    });
    const p = buildLocalProvider(cfg);
    const chunks = [
      {
        chunkId: 1,
        documentId: 1,
        text: "x",
        score: 0,
        source: "hybrid" as const,
      },
      {
        chunkId: 2,
        documentId: 1,
        text: "y",
        score: 0,
        source: "hybrid" as const,
      },
    ];
    const out = await p.rerank.rerank("q", chunks, { topN: 1 });
    expect(out).toHaveLength(1);
    expect(out[0]?.chunkId).toBe(2);
    expect(out[0]?.score).toBeCloseTo(0.9);
  });

  it("short-circuits on zero chunks", async () => {
    const p = buildLocalProvider(cfg);
    expect(await p.rerank.rerank("q", [], { topN: 5 })).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
