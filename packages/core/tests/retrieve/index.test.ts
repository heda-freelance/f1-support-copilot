import { describe, it, expect, vi } from "vitest";
import { retrieve } from "../../src/retrieve/index.js";
import type { RetrievedChunk } from "../../src/retrieve/vector.js";

describe("retrieve pipeline", () => {
  it("calls vector + bm25, fuses, then reranks", async () => {
    const vec: RetrievedChunk[] = [
      { chunkId: 1, documentId: 1, text: "vec1", score: 0.9, source: "vector" },
    ];
    const kw: RetrievedChunk[] = [
      { chunkId: 2, documentId: 1, text: "kw1", score: 0.8, source: "bm25" },
    ];

    const deps = {
      embedQuery: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      vectorSearch: vi.fn().mockResolvedValue(vec),
      bm25Search: vi.fn().mockResolvedValue(kw),
      rerank: vi.fn().mockImplementation(async (_q, chunks) => chunks),
    };

    const out = await retrieve("how do I reset password", {
      ...deps,
      candidatePool: 20,
      topN: 4,
    });

    expect(deps.embedQuery).toHaveBeenCalledWith("how do I reset password");
    expect(deps.vectorSearch).toHaveBeenCalled();
    expect(deps.bm25Search).toHaveBeenCalled();
    expect(deps.rerank).toHaveBeenCalled();
    expect(out.length).toBeGreaterThan(0);
  });
});
