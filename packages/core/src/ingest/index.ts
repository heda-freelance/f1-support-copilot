import { parseMarkdown, parseHtml, type ParsedDoc } from "./parse.js";
import { chunkText } from "./chunk.js";
import type { Db } from "../db/client.js";
import { documents, chunks as chunksTable } from "../db/schema.js";

export interface IngestInput {
  source: string;
  url?: string;
  format: "markdown" | "html";
  content: string;
}

export interface IngestOptions {
  db: Db;
  embed: (texts: string[]) => Promise<number[][]>;
  maxTokens?: number;
  overlap?: number;
}

export async function ingestDocument(
  input: IngestInput,
  opts: IngestOptions,
): Promise<number> {
  const parsed: ParsedDoc =
    input.format === "markdown"
      ? parseMarkdown(input.content)
      : parseHtml(input.content);

  const docRows = await opts.db
    .insert(documents)
    .values({
      source: input.source,
      title: parsed.title,
      url: input.url ?? null,
    })
    .returning({ id: documents.id });
  const docId = docRows[0]!.id;

  const pieces = chunkText(parsed.text, {
    maxTokens: opts.maxTokens ?? 500,
    overlap: opts.overlap ?? 60,
  });
  if (pieces.length === 0) return docId;

  const vectors = await opts.embed(pieces.map((p) => p.text));

  await opts.db.insert(chunksTable).values(
    pieces.map((p, i) => ({
      documentId: docId,
      chunkIndex: p.index,
      text: p.text,
      tokenCount: p.tokenCount,
      embedding: vectors[i] ?? null,
    })),
  );

  return docId;
}
