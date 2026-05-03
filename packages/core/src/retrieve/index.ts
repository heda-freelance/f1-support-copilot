import type { RetrievedChunk } from "./vector.js";
import { rrfMerge } from "./hybrid.js";

export interface RetrieveDeps {
  embedQuery: (q: string) => Promise<number[]>;
  vectorSearch: (
    vec: number[],
    opts: { limit: number },
  ) => Promise<RetrievedChunk[]>;
  bm25Search: (q: string, opts: { limit: number }) => Promise<RetrievedChunk[]>;
  rerank: (
    q: string,
    chunks: RetrievedChunk[],
    opts: { topN: number },
  ) => Promise<RetrievedChunk[]>;
  candidatePool: number;
  topN: number;
}

export async function retrieve(
  query: string,
  deps: RetrieveDeps,
): Promise<RetrievedChunk[]> {
  const qVec = await deps.embedQuery(query);
  const [vec, kw] = await Promise.all([
    deps.vectorSearch(qVec, { limit: deps.candidatePool }),
    deps.bm25Search(query, { limit: deps.candidatePool }),
  ]);
  const fused = rrfMerge(vec, kw, { k: 60, limit: deps.candidatePool });
  return deps.rerank(query, fused, { topN: deps.topN });
}
