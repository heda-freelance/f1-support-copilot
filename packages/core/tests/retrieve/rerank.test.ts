import { describe, it, expect, vi } from "vitest";
import { rerank } from "../../src/retrieve/rerank.js";
import type { RetrievedChunk } from "../../src/retrieve/vector.js";

describe("rerank", () => {
  it("reorders chunks using cohere relevance scores", async () => {
    const chunks: RetrievedChunk[] = [
      {
        chunkId: 1,
        documentId: 1,
        text: "billing info",
        score: 0.9,
        source: "hybrid",
      },
      {
        chunkId: 2,
        documentId: 1,
        text: "password reset steps",
        score: 0.85,
        source: "hybrid",
      },
      {
        chunkId: 3,
        documentId: 1,
        text: "general intro",
        score: 0.6,
        source: "hybrid",
      },
    ];
    const fakeClient = {
      rerank: vi.fn().mockResolvedValue({
        results: [
          { index: 1, relevanceScore: 0.99 },
          { index: 0, relevanceScore: 0.4 },
          { index: 2, relevanceScore: 0.1 },
        ],
      }),
    } as any;

    const out = await rerank(fakeClient, "how to reset password", chunks, {
      topN: 2,
    });

    expect(out).toHaveLength(2);
    expect(out[0]?.chunkId).toBe(2);
    expect(out[0]?.score).toBeCloseTo(0.99);
    expect(out[1]?.chunkId).toBe(1);
  });

  it("returns input unchanged on zero chunks", async () => {
    const fakeClient = { rerank: vi.fn() } as any;
    const out = await rerank(fakeClient, "q", [], { topN: 5 });
    expect(out).toEqual([]);
    expect(fakeClient.rerank).not.toHaveBeenCalled();
  });
});
