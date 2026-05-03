import { readFile, readdir } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { ingestDocument } from "@support-copilot/core";
import { createDbClient } from "@support-copilot/core";
import { embedTexts } from "@support-copilot/core";
import { sql } from "drizzle-orm";

async function main() {
  const db = createDbClient(process.env.DATABASE_URL!);
  await db.execute(sql`TRUNCATE documents RESTART IDENTITY CASCADE`);

  const dir = "seed/docs";
  const files = (await readdir(dir)).filter((f) => extname(f) === ".md");
  for (const f of files) {
    const content = await readFile(join(dir, f), "utf8");
    const id = await ingestDocument(
      { source: `seed/${f}`, format: "markdown", content },
      { db, embed: (texts) => embedTexts(texts), maxTokens: 400, overlap: 60 },
    );
    console.log(`seeded ${basename(f)} → doc ${id}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
