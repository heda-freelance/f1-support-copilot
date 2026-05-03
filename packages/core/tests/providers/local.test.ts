import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildLocalProvider, type LocalConfig } from "../../src/providers/local.js";

const cfg: LocalConfig = {
  llmUrl: "http://x/v1",
  llmModel: "default",
  embedUrl: "http://e/v1",
  embedModel: "default",
  embedDim: 768,
  rerankUrl: "http://r",
  rerankModel: "default",
};

const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn() as any;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("local embed", () => {
  it("calls llama.cpp /v1/embeddings via OpenAI SDK and returns vectors", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          object: "list",
          data: [
            { embedding: [0.1, 0.2], index: 0 },
            { embedding: [0.3, 0.4], index: 1 },
          ],
          model: "default",
          usage: { prompt_tokens: 0, total_tokens: 0 },
        }),
      json: async () => ({
        object: "list",
        data: [
          { embedding: [0.1, 0.2], index: 0 },
          { embedding: [0.3, 0.4], index: 1 },
        ],
        model: "default",
        usage: { prompt_tokens: 0, total_tokens: 0 },
      }),
    });
    const p = buildLocalProvider(cfg);
    const out = await p.embed.embed(["a", "b"]);
    expect(out).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    const call = (globalThis.fetch as any).mock.calls[0];
    expect(String(call[0])).toContain("http://e/v1/embeddings");
    const body = JSON.parse(call[1].body);
    expect(body.input).toEqual(["a", "b"]);
    expect(body.model).toBe("default");
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
});

describe("local rerank", () => {
  it("calls llama.cpp /v1/rerank and reorders by relevance_score", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { index: 0, relevance_score: 0.2 },
          { index: 1, relevance_score: 0.9 },
        ],
      }),
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
    const call = (globalThis.fetch as any).mock.calls[0];
    expect(call[0]).toBe("http://r/v1/rerank");
    const body = JSON.parse(call[1].body);
    expect(body.query).toBe("q");
    expect(body.documents).toEqual(["x", "y"]);
  });

  it("short-circuits on zero chunks", async () => {
    const p = buildLocalProvider(cfg);
    expect(await p.rerank.rerank("q", [], { topN: 5 })).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("throws on non-ok rerank response", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
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
    ];
    await expect(p.rerank.rerank("q", chunks, { topN: 1 })).rejects.toThrow(
      "llama.cpp rerank: 503",
    );
  });
});
