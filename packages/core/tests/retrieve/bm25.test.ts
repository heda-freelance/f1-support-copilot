import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createDbClient } from "../../src/db/client.js";
import { ingestDocument } from "../../src/ingest/index.js";
import { bm25Search } from "../../src/retrieve/bm25.js";
import { sql } from "drizzle-orm";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgres://copilot:copilot@localhost:5432/copilot";

describe("bm25Search", () => {
  const db = createDbClient(DB_URL);

  beforeAll(async () => {
    await db.execute(sql`TRUNCATE documents RESTART IDENTITY CASCADE`);
    const fakeEmbed = vi
      .fn()
      .mockImplementation(async (texts: string[]) =>
        texts.map(() => new Array(1536).fill(0)),
      );
    await ingestDocument(
      {
        source: "seed",
        format: "markdown",
        content:
          "# Reset password\n\nGo to account settings to reset your password.",
      },
      { db, embed: fakeEmbed, maxTokens: 100, overlap: 0 },
    );
    await ingestDocument(
      {
        source: "seed",
        format: "markdown",
        content:
          "# Billing\n\nBilling cycles run monthly. Invoices are emailed.",
      },
      { db, embed: fakeEmbed, maxTokens: 100, overlap: 0 },
    );
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE documents RESTART IDENTITY CASCADE`);
  });

  it("ranks the password doc higher for password queries", async () => {
    const results = await bm25Search(db, "how do I reset my password", {
      limit: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.text.toLowerCase()).toContain("password");
  });

  it("returns empty array when no docs match", async () => {
    const results = await bm25Search(db, "xyzzyfoobarnotrealtoken", {
      limit: 5,
    });
    expect(results).toEqual([]);
  });
});
