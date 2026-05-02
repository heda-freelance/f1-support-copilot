import { readFile } from "node:fs/promises";
import { extname, basename } from "node:path";
import { ingestDocument } from "./index.js";
import { embedTexts } from "./embed.js";
import { createDbClient } from "../db/client.js";

async function main() {
  const [, , ...paths] = process.argv;
  if (paths.length === 0) {
    console.error("usage: ingest <file> [<file>...]");
    process.exit(1);
  }

  const db = createDbClient(process.env.DATABASE_URL!);
  for (const p of paths) {
    const content = await readFile(p, "utf8");
    const ext = extname(p).toLowerCase();
    const format = ext === ".md" ? "markdown" : "html";
    const id = await ingestDocument(
      { source: `file://${p}`, format, content },
      { db, embed: (texts) => embedTexts(texts) },
    );
    console.log(`ingested ${basename(p)} as document ${id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
