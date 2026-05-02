import { describe, it, expect, vi } from "vitest";
import { ingestDocument } from "../../src/ingest/index.js";
import { createDbClient } from "../../src/db/client.js";
import { documents, chunks } from "../../src/db/schema.js";
import { eq } from "drizzle-orm";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgres://copilot:copilot@localhost:5432/copilot";

describe("ingestDocument", () => {
  it("parses, chunks, embeds, and persists a markdown doc", async () => {
    const db = createDbClient(DB_URL);
    const fakeEmbed = vi
      .fn()
      .mockImplementation(async (texts: string[]) =>
        texts.map(() => new Array(1536).fill(0.1)),
      );

    const docId = await ingestDocument(
      {
        source: "test://hello",
        url: "https://example.com/hello",
        format: "markdown",
        content: "# Hello\n\nThis is a help doc.",
      },
      { db, embed: fakeEmbed, maxTokens: 100, overlap: 20 },
    );

    const docRow = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docId));
    expect(docRow[0]?.title).toBe("Hello");

    const chunkRows = await db
      .select()
      .from(chunks)
      .where(eq(chunks.documentId, docId));
    expect(chunkRows.length).toBeGreaterThan(0);
    expect(chunkRows[0]?.tokenCount).toBeGreaterThan(0);

    await db.delete(documents).where(eq(documents.id, docId));
  });
});
