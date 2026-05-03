import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createDbClient } from "../../src/db/client.js";
import { ingestDocument } from "../../src/ingest/index.js";
import { vectorSearch } from "../../src/retrieve/vector.js";
import { sql } from "drizzle-orm";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgres://copilot:copilot@localhost:5432/copilot";

describe("vectorSearch", () => {
  const db = createDbClient(DB_URL);
  const fixedQueryVector = new Array(1536)
    .fill(0)
    .map((_, i) => (i === 0 ? 1 : 0));

  beforeAll(async () => {
    await db.execute(sql`TRUNCATE documents RESTART IDENTITY CASCADE`);
    const fakeEmbed = vi.fn().mockImplementation(async (texts: string[]) =>
      texts.map((t, idx) => {
        const v = new Array(1536).fill(0);
        v[0] = t.includes("password") ? 1 : 0;
        v[1] = idx;
        return v;
      }),
    );
    await ingestDocument(
      {
        source: "seed",
        format: "markdown",
        content: "# Reset password\n\nGo to settings to reset your password.",
      },
      { db, embed: fakeEmbed, maxTokens: 100, overlap: 0 },
    );
    await ingestDocument(
      {
        source: "seed",
        format: "markdown",
        content: "# Billing\n\nBilling cycles run monthly.",
      },
      { db, embed: fakeEmbed, maxTokens: 100, overlap: 0 },
    );
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE documents RESTART IDENTITY CASCADE`);
  });

  it("returns chunks ranked by cosine similarity to the query vector", async () => {
    const results = await vectorSearch(db, fixedQueryVector, { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.text.toLowerCase()).toContain("password");
    expect(results[0]?.score).toBeGreaterThan(
      results[results.length - 1]!.score - 0.0001,
    );
  });
});
