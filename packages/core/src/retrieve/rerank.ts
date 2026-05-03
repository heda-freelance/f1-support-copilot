import type { CohereClient } from "cohere-ai";
import type { RetrievedChunk } from "./vector.js";

export async function rerank(
  client: Pick<CohereClient, "rerank">,
  query: string,
  chunks: RetrievedChunk[],
  opts: { topN: number; model?: string },
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];

  const res = await client.rerank({
    model: opts.model ?? "rerank-english-v3.0",
    query,
    documents: chunks.map((c) => c.text),
    topN: opts.topN,
  });

  return (res.results ?? []).slice(0, opts.topN).map((r) => {
    const original = chunks[r.index]!;
    return {
      ...original,
      score: r.relevanceScore,
    };
  });
}
