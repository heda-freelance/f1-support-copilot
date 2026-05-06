import { NextResponse } from "next/server";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
import {
  createDbClient,
  vectorSearch,
  bm25Search,
  retrieve,
  applyGuard,
  buildProviders,
} from "@support-copilot/core";

loadEnvConfig(resolve(process.cwd(), "../.."));

const db = createDbClient(process.env.DATABASE_URL!);
const providers = buildProviders();

export async function POST(req: Request) {
  const { query } = (await req.json()) as { query: string };
  if (!query)
    return NextResponse.json({ error: "query required" }, { status: 400 });

  const chunks = await retrieve(query, {
    embedQuery: async (q) => (await providers.embed.embed([q]))[0]!,
    vectorSearch: (vec, opts) => vectorSearch(db, vec, opts),
    bm25Search: (q, opts) => bm25Search(db, q, opts),
    rerank: (q, c, opts) => providers.rerank.rerank(q, c, opts),
    candidatePool: 20,
    topN: 6,
  });

  const raw = await providers.chat.generateAnswer({ query, chunks });
  const guarded = applyGuard(raw, chunks, {
    minConfidence: providers.minConfidence,
  });

  return NextResponse.json({
    answer: guarded.answer,
    citations: guarded.citations.map((c) => {
      const chunk = chunks.find((ch) => ch.chunkId === c.chunkId);
      return { chunkId: c.chunkId, quote: c.quote, text: chunk?.text ?? null };
    }),
    confidence: guarded.confidence,
    escalate: guarded.escalate,
  });
}
