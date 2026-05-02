import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { createDbClient } from "../src/db/client.js";

describe("db connectivity", () => {
  it("connects and lists tables", async () => {
    const db = createDbClient(
      process.env.DATABASE_URL ??
        "postgres://copilot:copilot@localhost:5432/copilot",
    );
    const rows = await db.execute<{ tablename: string }>(
      sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
    );
    const names = rows.map((r) => r.tablename);
    expect(names).toContain("chunks");
    expect(names).toContain("documents");
  });
});
