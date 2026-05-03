import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";

export interface RetrievedChunk {
  chunkId: number;
  documentId: number;
  text: string;
  score: number;
  source: "vector" | "bm25" | "hybrid";
}

export async function vectorSearch(
  db: Db,
  queryVector: number[],
  opts: { limit: number },
): Promise<RetrievedChunk[]> {
  const vecLiteral = `[${queryVector.join(",")}]`;
  const rows = await db.execute<{
    id: number;
    document_id: number;
    text: string;
    distance: number;
  }>(sql`
    SELECT id, document_id, text, embedding <=> ${vecLiteral}::vector AS distance
    FROM chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vecLiteral}::vector
    LIMIT ${opts.limit}
  `);

  return rows.map((r) => ({
    chunkId: r.id,
    documentId: r.document_id,
    text: r.text,
    score: 1 - r.distance,
    source: "vector" as const,
  }));
}
