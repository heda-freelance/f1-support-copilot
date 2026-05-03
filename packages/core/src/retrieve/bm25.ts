import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { RetrievedChunk } from "./vector.js";

export async function bm25Search(
  db: Db,
  query: string,
  opts: { limit: number },
): Promise<RetrievedChunk[]> {
  const tsq = query
    .split(/\s+/)
    .filter((w) => /\w/.test(w))
    .map((w) => w.replace(/[^\w]/g, "") + ":*")
    .join(" & ");
  if (!tsq) return [];

  const rows = await db.execute<{
    id: number;
    document_id: number;
    text: string;
    rank: number;
  }>(sql`
    SELECT id, document_id, text,
           ts_rank_cd(to_tsvector('english', text), to_tsquery('english', ${tsq})) AS rank
    FROM chunks
    WHERE to_tsvector('english', text) @@ to_tsquery('english', ${tsq})
    ORDER BY rank DESC
    LIMIT ${opts.limit}
  `);

  return rows.map((r) => ({
    chunkId: r.id,
    documentId: r.document_id,
    text: r.text,
    score: r.rank,
    source: "bm25" as const,
  }));
}
