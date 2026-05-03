import type { RetrievedChunk } from "./vector.js";

export function rrfMerge(
  vec: RetrievedChunk[],
  kw: RetrievedChunk[],
  opts: { k: number; limit: number },
): RetrievedChunk[] {
  const map = new Map<number, RetrievedChunk & { rrf: number }>();

  const accumulate = (list: RetrievedChunk[]) => {
    list.forEach((chunk, rank) => {
      const inc = 1 / (opts.k + rank + 1);
      const existing = map.get(chunk.chunkId);
      if (existing) {
        existing.rrf += inc;
      } else {
        map.set(chunk.chunkId, { ...chunk, rrf: inc, source: "hybrid" });
      }
    });
  };

  accumulate(vec);
  accumulate(kw);

  return Array.from(map.values())
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, opts.limit)
    .map(({ rrf, ...rest }) => ({ ...rest, score: rrf }));
}
