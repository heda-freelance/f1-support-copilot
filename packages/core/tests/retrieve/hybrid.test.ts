import { describe, it, expect } from "vitest";
import { rrfMerge } from "../../src/retrieve/hybrid.js";
import type { RetrievedChunk } from "../../src/retrieve/vector.js";

const mk = (
  id: number,
  source: "vector" | "bm25",
  score: number,
): RetrievedChunk => ({
  chunkId: id,
  documentId: 1,
  text: `chunk ${id}`,
  score,
  source,
});

describe("rrfMerge", () => {
  it("merges two ranked lists by reciprocal rank fusion", () => {
    const vec = [
      mk(1, "vector", 0.9),
      mk(2, "vector", 0.7),
      mk(3, "vector", 0.5),
    ];
    const kw = [mk(2, "bm25", 0.8), mk(4, "bm25", 0.6), mk(1, "bm25", 0.4)];
    const merged = rrfMerge(vec, kw, { k: 60, limit: 3 });
    expect(merged.map((c) => c.chunkId)).toEqual([2, 1, 4]);
    expect(merged[0]?.source).toBe("hybrid");
  });

  it("works with one empty list", () => {
    const vec = [mk(1, "vector", 0.9)];
    const merged = rrfMerge(vec, [], { k: 60, limit: 5 });
    expect(merged.map((c) => c.chunkId)).toEqual([1]);
  });

  it("respects limit", () => {
    const vec = [mk(1, "vector", 1), mk(2, "vector", 0.9)];
    const kw = [mk(3, "bm25", 0.8)];
    const merged = rrfMerge(vec, kw, { k: 60, limit: 2 });
    expect(merged).toHaveLength(2);
  });
});
