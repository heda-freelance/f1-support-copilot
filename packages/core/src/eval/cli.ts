import { loadCases } from "./loader.js";
import { runCases, type AnnotatedAnswer } from "./runner.js";
import { writeFile } from "node:fs/promises";
import { createDbClient } from "../db/client.js";
import { vectorSearch } from "../retrieve/vector.js";
import { bm25Search } from "../retrieve/bm25.js";
import { retrieve } from "../retrieve/index.js";
import { applyGuard } from "../generate/guard.js";
import { documents } from "../db/schema.js";
import { inArray } from "drizzle-orm";
import { buildProviders } from "../providers/index.js";

async function buildAnswerFn() {
  const db = createDbClient(process.env.DATABASE_URL!);
  const providers = buildProviders();

  return async (query: string): Promise<AnnotatedAnswer> => {
    const chunks = await retrieve(query, {
      embedQuery: async (q) => (await providers.embed.embed([q]))[0]!,
      vectorSearch: (vec, opts) => vectorSearch(db, vec, opts),
      bm25Search: (q, opts) => bm25Search(db, q, opts),
      rerank: (q, c, opts) => providers.rerank.rerank(q, c, opts),
      candidatePool: 20,
      topN: 6,
    });
    const raw = await providers.chat.generateAnswer({ query, chunks });
    const guarded = applyGuard(raw, chunks, { minConfidence: 0.5 });

    const citedDocIds = [
      ...new Set(
        chunks
          .filter((c) =>
            guarded.citations.some((cit) => cit.chunkId === c.chunkId),
          )
          .map((c) => c.documentId),
      ),
    ];
    let docSources: string[] = [];
    if (citedDocIds.length > 0) {
      const docs = await db
        .select()
        .from(documents)
        .where(inArray(documents.id, citedDocIds));
      docSources = docs.map((d) =>
        d.source.replace(/^.*[\\/]/, "").replace(/\.[a-z]+$/, ""),
      );
    }
    return { ...guarded, _docSources: docSources };
  };
}

async function main() {
  const path = process.argv[2] ?? "eval/cases.yaml";
  const cases = await loadCases(path);
  const answerFn = await buildAnswerFn();
  const report = await runCases(cases, answerFn);

  console.log(`\n=== Eval Report ===`);
  console.log(`${report.passed}/${report.total} passed\n`);
  for (const r of report.results) {
    const tag = r.passed ? "PASS" : "FAIL";
    console.log(
      `${tag}  ${r.id}` +
        (r.failures.length ? `  (${r.failures.join(", ")})` : ""),
    );
  }
  await writeFile(
    "eval/report.json",
    JSON.stringify(
      { total: report.total, passed: report.passed, results: report.results },
      null,
      2,
    ),
  );
  if (report.passed < report.total) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
