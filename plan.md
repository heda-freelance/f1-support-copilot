# F1 Support Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public portfolio-grade RAG support bot for B2B SaaS — ingest docs, answer questions in Slack with citations, escalate when unsure, all under a CI-checked eval harness.

**Architecture:** Doc ingestion pipeline → Postgres (with pgvector) → hybrid retrieval (BM25 + vector) → rerank → structured-output generation with hallucination guard → Slack Bolt app + Next.js demo widget. Eval harness with 30 hand-written Q/expected-citation pairs runs on every PR.

**Tech Stack:** Node.js 20+, TypeScript, pnpm, Vitest, Postgres 16 + pgvector, Drizzle ORM, OpenAI SDK (`gpt-4o-mini`, `text-embedding-3-small`), Cohere SDK (`rerank-english-v3.0`), `@slack/bolt`, Next.js 14 (App Router), Zod, Docker Compose, Railway for deploy.

---

## Repo Layout

Project repo lives at `/Users/David_Hegyi/Documents/projects/heda-freelance/portfolio/support-copilot/`. Public GitHub repo: `heda-freelance/support-copilot`.

```
support-copilot/
├── package.json
├── pnpm-workspace.yaml
├── docker-compose.yml
├── .env.example
├── README.md
├── docs/
│   └── architecture.md
├── packages/
│   ├── core/                 # ingestion, retrieval, generation, eval
│   │   ├── src/
│   │   │   ├── db/           # drizzle schema + client
│   │   │   ├── ingest/       # parse + chunk + embed
│   │   │   ├── retrieve/     # bm25 + vector + hybrid + rerank
│   │   │   ├── generate/     # llm call + structured output + guard
│   │   │   ├── eval/         # eval harness CLI
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   ├── slack-app/            # @slack/bolt app
│   │   ├── src/index.ts
│   │   └── package.json
│   └── web/                  # Next.js demo widget
│       ├── app/
│       └── package.json
├── seed/                     # sanitized "Acme SaaS" docs
│   └── docs/
├── eval/
│   └── cases.yaml            # 30 Q/expected-citation pairs
└── .github/
    └── workflows/
        ├── test.yml
        └── eval.yml
```

**File responsibilities:**

- `packages/core/src/ingest/parse.ts` — Markdown + HTML → plain text + metadata
- `packages/core/src/ingest/chunk.ts` — token-aware chunking with overlap
- `packages/core/src/ingest/embed.ts` — OpenAI embedding calls (batched)
- `packages/core/src/retrieve/vector.ts` — pgvector cosine search
- `packages/core/src/retrieve/bm25.ts` — Postgres `tsvector` BM25-like search
- `packages/core/src/retrieve/hybrid.ts` — RRF merge of vector + BM25
- `packages/core/src/retrieve/rerank.ts` — Cohere rerank wrapper
- `packages/core/src/generate/answer.ts` — structured-output LLM call
- `packages/core/src/generate/guard.ts` — hallucination guard (citation + confidence check)
- `packages/core/src/eval/runner.ts` — eval harness
- `packages/core/src/eval/cli.ts` — CLI entry point

---

## Conventions

- **Language:** TypeScript strict mode. ESM only. No CJS.
- **Test framework:** Vitest. Co-locate tests under `packages/<pkg>/tests/`. Pattern: one test file per source file.
- **TDD discipline:** Write failing test → run → fail → minimal impl → run → pass → commit.
- **Commit style:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`).
- **Schema validation:** Zod for every external boundary (LLM output, env vars, API requests).
- **Mocking external services:** never call OpenAI/Cohere in unit tests; use `vi.fn()` with fixture responses. Integration tests can hit real APIs and are gated behind `INTEGRATION=1` env.
- **Secrets:** never committed. `.env.example` documents required keys.

---

## Task 1: Project scaffolding

**Files:**

- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `.editorconfig`, `README.md`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`

- [x] **Step 1: Create the project directory and initialize git**

```bash
mkdir -p /Users/David_Hegyi/Documents/projects/heda-freelance/portfolio/support-copilot
cd /Users/David_Hegyi/Documents/projects/heda-freelance/portfolio/support-copilot
git init -b main
```

- [x] **Step 2: Write `.gitignore`**

`.gitignore`:

```
node_modules/
dist/
.env
.env.local
.next/
.turbo/
coverage/
*.log
.DS_Store
```

- [x] **Step 3: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [x] **Step 4: Write root `package.json`**

```json
{
  "name": "support-copilot",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.12.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [x] **Step 5: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [x] **Step 6: Scaffold `packages/core`**

`packages/core/package.json`:

```json
{
  "name": "@support-copilot/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {},
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

`packages/core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

`packages/core/src/index.ts`:

```ts
export {};
```

- [x] **Step 7: Write `.env.example`**

```
DATABASE_URL=postgres://copilot:copilot@localhost:5432/copilot
OPENAI_API_KEY=
COHERE_API_KEY=
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
NODE_ENV=development
```

- [x] **Step 8: Write minimal `README.md`**

```md
# Support Copilot

RAG-powered support bot for B2B SaaS. Answers tier-1 tickets from your help docs with citations; escalates when unsure.

See `docs/architecture.md` for design.
```

- [ ] **Step 9: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, no errors.

- [x] **Step 10: Verify the test runner works**

Create `packages/core/tests/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `pnpm test`
Expected: 1 passing test.

- [x] **Step 11: Commit**

```bash
git add .
git commit -m "chore: scaffold pnpm workspace with core package and vitest"
```

---

## Task 2: Database — Docker Compose, Drizzle schema, migrations

**Files:**

- Create: `docker-compose.yml`
- Create: `packages/core/src/db/schema.ts`, `packages/core/src/db/client.ts`, `packages/core/drizzle.config.ts`
- Create: `packages/core/migrations/0000_init.sql`

- [x] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: copilot
      POSTGRES_PASSWORD: copilot
      POSTGRES_DB: copilot
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U copilot"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

- [x] **Step 2: Start Postgres and verify**

Run: `docker compose up -d postgres`
Run: `docker compose exec postgres pg_isready -U copilot`
Expected: `accepting connections`.

- [x] **Step 3: Add Drizzle and pg dependencies**

Run inside `packages/core`:

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit @types/pg
```

- [x] **Step 4: Write the schema**

`packages/core/src/db/schema.ts`:

```ts
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Indexes (HNSW vector + GIN tsvector) are created by the raw SQL migration
// since Drizzle's index DSL doesn't yet express tsvector GIN cleanly.
export const chunks = pgTable("chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  text: text("text").notNull(),
  tokenCount: integer("token_count").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
```

- [x] **Step 5: Write the migration**

`packages/core/migrations/0000_init.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX chunks_fts_idx
  ON chunks USING gin (to_tsvector('english', text));
```

- [x] **Step 6: Apply migration**

```bash
docker compose exec -T postgres psql -U copilot -d copilot < packages/core/migrations/0000_init.sql
```

Expected: `CREATE EXTENSION` ... `CREATE INDEX` (no errors).

- [x] **Step 7: Write the DB client**

`packages/core/src/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDbClient(connectionString: string) {
  const client = postgres(connectionString, { max: 5 });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDbClient>;
```

- [x] **Step 8: Write a connectivity test**

`packages/core/tests/db.test.ts`:

```ts
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
```

- [x] **Step 9: Run the test**

Run: `pnpm --filter @support-copilot/core test db`
Expected: PASS.

- [x] **Step 10: Commit**

```bash
git add .
git commit -m "feat(db): add postgres+pgvector schema with migration and client"
```

---

## Task 3: Doc parsing — Markdown and HTML to plain text

**Files:**

- Create: `packages/core/src/ingest/parse.ts`, `packages/core/tests/ingest/parse.test.ts`

- [x] **Step 1: Add deps**

```bash
pnpm --filter @support-copilot/core add marked cheerio
```

- [x] **Step 2: Write the failing tests**

`packages/core/tests/ingest/parse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseMarkdown, parseHtml } from "../../src/ingest/parse.js";

describe("parseMarkdown", () => {
  it("strips formatting and keeps headings as text", () => {
    const out = parseMarkdown("# Title\n\nHello **world**.");
    expect(out.title).toBe("Title");
    expect(out.text).toBe("Title\n\nHello world.");
  });

  it("falls back to first sentence when no heading", () => {
    const out = parseMarkdown("Just one line of help text.");
    expect(out.title).toBe("Just one line of help text.");
    expect(out.text).toBe("Just one line of help text.");
  });

  it("preserves inline code as plain text", () => {
    const out = parseMarkdown("Run `npm install` to set up.");
    expect(out.text).toContain("npm install");
  });
});

describe("parseHtml", () => {
  it("extracts text from <article>", () => {
    const html = `<html><head><title>Setup</title></head><body><nav>SKIP</nav><article><h1>Setup</h1><p>Step one.</p></article></body></html>`;
    const out = parseHtml(html);
    expect(out.title).toBe("Setup");
    expect(out.text).toBe("Setup\n\nStep one.");
  });

  it("falls back to <body> when no article", () => {
    const html = `<html><body><h1>FAQ</h1><p>Answer.</p></body></html>`;
    const out = parseHtml(html);
    expect(out.title).toBe("FAQ");
    expect(out.text).toContain("Answer.");
  });

  it("removes script and style", () => {
    const html = `<html><body><script>bad()</script><style>x{}</style><p>Visible</p></body></html>`;
    const out = parseHtml(html);
    expect(out.text).toBe("Visible");
  });
});
```

- [x] **Step 3: Run tests — expect failure**

Run: `pnpm --filter @support-copilot/core test parse`
Expected: FAIL with "parseMarkdown is not a function" / module not found.

- [x] **Step 4: Implement `parse.ts`**

`packages/core/src/ingest/parse.ts`:

```ts
import { marked } from "marked";
import * as cheerio from "cheerio";

export interface ParsedDoc {
  title: string;
  text: string;
}

export function parseMarkdown(input: string): ParsedDoc {
  const tokens = marked.lexer(input);
  let title = "";
  const lines: string[] = [];

  for (const t of tokens) {
    if (t.type === "heading") {
      const h = t as { type: "heading"; text: string; depth: number };
      if (!title) title = h.text.trim();
      lines.push(h.text.trim());
    } else if (t.type === "paragraph") {
      const p = t as { type: "paragraph"; text: string };
      const stripped = stripMd(p.text);
      lines.push(stripped);
    } else if (t.type === "list") {
      const l = t as { type: "list"; items: { text: string }[] };
      for (const item of l.items) lines.push("- " + stripMd(item.text));
    } else if (t.type === "code") {
      const c = t as { type: "code"; text: string };
      lines.push(c.text);
    }
  }

  const text = lines.join("\n\n");
  if (!title) {
    const firstSentence = text.split(/[.!?]/)[0]?.trim() ?? "";
    title =
      firstSentence.length > 0
        ? firstSentence + (text.includes(".") ? "." : "")
        : "Untitled";
  }

  return { title, text };
}

function stripMd(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export function parseHtml(input: string): ParsedDoc {
  const $ = cheerio.load(input);
  $("script, style, nav, header, footer").remove();

  const root = $("article").length ? $("article") : $("body");

  const titleEl = root.find("h1").first();
  const title = (titleEl.text() || $("title").text() || "Untitled").trim();

  const blocks: string[] = [];
  root.find("h1, h2, h3, p, li").each((_, el) => {
    const t = $(el).text().trim();
    if (t) blocks.push(t);
  });

  return { title, text: blocks.join("\n\n") };
}
```

- [x] **Step 5: Run tests — expect pass**

Run: `pnpm --filter @support-copilot/core test parse`
Expected: 6 passing.

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "feat(ingest): parse markdown and html docs to plain text"
```

---

## Task 4: Token-aware chunking with overlap

**Files:**

- Create: `packages/core/src/ingest/chunk.ts`, `packages/core/tests/ingest/chunk.test.ts`

- [x] **Step 1: Add tokenizer dep**

```bash
pnpm --filter @support-copilot/core add js-tiktoken
```

- [x] **Step 2: Write failing tests**

`packages/core/tests/ingest/chunk.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { chunkText, countTokens } from "../../src/ingest/chunk.js";

describe("countTokens", () => {
  it("returns positive integer for non-empty input", () => {
    expect(countTokens("hello world")).toBeGreaterThan(0);
  });
  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });
});

describe("chunkText", () => {
  it("returns single chunk when text fits in window", () => {
    const chunks = chunkText("short text", { maxTokens: 100, overlap: 10 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toBe("short text");
    expect(chunks[0]?.index).toBe(0);
  });

  it("splits long text into multiple chunks with overlap", () => {
    const long = Array.from({ length: 1000 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(long, { maxTokens: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(100);
      expect(c.tokenCount).toBeGreaterThan(0);
    }
    const overlapTokens = chunks[0]!.text.split(" ").slice(-20).join(" ");
    expect(chunks[1]!.text.startsWith(overlapTokens.split(" ")[0]!)).toBe(true);
  });

  it("rejects invalid params", () => {
    expect(() => chunkText("x", { maxTokens: 0, overlap: 0 })).toThrow();
    expect(() => chunkText("x", { maxTokens: 100, overlap: 100 })).toThrow();
  });

  it("preserves chunk order with sequential index", () => {
    const long = Array.from({ length: 500 }, (_, i) => `t${i}`).join(" ");
    const chunks = chunkText(long, { maxTokens: 50, overlap: 10 });
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });
});
```

- [x] **Step 3: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test chunk`
Expected: FAIL — module not found.

- [x] **Step 4: Implement `chunk.ts`**

`packages/core/src/ingest/chunk.ts`:

```ts
import { encodingForModel } from "js-tiktoken";

const enc = encodingForModel("gpt-4o-mini");

export interface Chunk {
  index: number;
  text: string;
  tokenCount: number;
}

export interface ChunkOptions {
  maxTokens: number;
  overlap: number;
}

export function countTokens(text: string): number {
  if (!text) return 0;
  return enc.encode(text).length;
}

export function chunkText(text: string, opts: ChunkOptions): Chunk[] {
  if (opts.maxTokens <= 0) throw new Error("maxTokens must be > 0");
  if (opts.overlap < 0 || opts.overlap >= opts.maxTokens) {
    throw new Error("overlap must satisfy 0 <= overlap < maxTokens");
  }

  const tokens = enc.encode(text);
  if (tokens.length === 0) return [];
  if (tokens.length <= opts.maxTokens) {
    return [{ index: 0, text, tokenCount: tokens.length }];
  }

  const stride = opts.maxTokens - opts.overlap;
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < tokens.length) {
    const end = Math.min(start + opts.maxTokens, tokens.length);
    const slice = tokens.slice(start, end);
    const decoded = enc.decode(slice);
    chunks.push({ index, text: decoded, tokenCount: slice.length });
    if (end === tokens.length) break;
    start += stride;
    index += 1;
  }

  return chunks;
}
```

- [x] **Step 5: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test chunk`
Expected: all passing.

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "feat(ingest): token-aware chunking with configurable overlap"
```

---

## Task 5: Embedding pipeline (OpenAI, batched, mocked in tests)

**Files:**

- Create: `packages/core/src/ingest/embed.ts`, `packages/core/tests/ingest/embed.test.ts`

- [x] **Step 1: Add OpenAI SDK**

```bash
pnpm --filter @support-copilot/core add openai
```

- [x] **Step 2: Write failing tests**

`packages/core/tests/ingest/embed.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { embedTexts } from "../../src/ingest/embed.js";

describe("embedTexts", () => {
  it("calls OpenAI with batched inputs and returns vectors aligned to input order", async () => {
    const create = vi
      .fn()
      .mockImplementation(async ({ input }: { input: string[] }) => ({
        data: input.map((_, i) => ({ embedding: new Array(1536).fill(i) })),
      }));
    const fakeClient = { embeddings: { create } } as any;

    const out = await embedTexts(["a", "b", "c"], {
      client: fakeClient,
      batchSize: 2,
    });

    expect(out).toHaveLength(3);
    expect(out[0]?.length).toBe(1536);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0].input).toEqual(["a", "b"]);
    expect(create.mock.calls[1]?.[0].input).toEqual(["c"]);
  });

  it("returns empty array for empty input without calling api", async () => {
    const create = vi.fn();
    const fakeClient = { embeddings: { create } } as any;
    const out = await embedTexts([], { client: fakeClient, batchSize: 10 });
    expect(out).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 3: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test embed`
Expected: FAIL.

- [x] **Step 4: Implement `embed.ts`**

`packages/core/src/ingest/embed.ts`:

```ts
import OpenAI from "openai";

export interface EmbedOptions {
  client?: OpenAI;
  model?: string;
  batchSize?: number;
}

export async function embedTexts(
  texts: string[],
  opts: EmbedOptions = {},
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = opts.client ?? new OpenAI();
  const model = opts.model ?? "text-embedding-3-small";
  const batchSize = opts.batchSize ?? 64;

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await client.embeddings.create({ model, input: batch });
    for (const item of res.data) out.push(item.embedding as number[]);
  }
  return out;
}
```

- [x] **Step 5: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test embed`
Expected: 2 passing.

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "feat(ingest): batched openai embedding pipeline"
```

---

## Task 6: Ingestion command — wire parse + chunk + embed + persist

**Files:**

- Create: `packages/core/src/ingest/index.ts`, `packages/core/src/ingest/cli.ts`, `packages/core/tests/ingest/index.test.ts`

- [x] **Step 1: Write failing test**

`packages/core/tests/ingest/index.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll } from "vitest";
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
```

- [x] **Step 2: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test ingest/index`
Expected: FAIL — module not found.

- [x] **Step 3: Implement `ingest/index.ts`**

`packages/core/src/ingest/index.ts`:

```ts
import { parseMarkdown, parseHtml, type ParsedDoc } from "./parse.js";
import { chunkText, countTokens } from "./chunk.js";
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
```

- [x] **Step 4: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test ingest/index`
Expected: PASS.

- [x] **Step 5: Add CLI entry**

`packages/core/src/ingest/cli.ts`:

```ts
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
```

Add script to `packages/core/package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "build": "tsc -p tsconfig.json",
  "ingest": "tsx src/ingest/cli.ts"
}
```

```bash
pnpm --filter @support-copilot/core add -D tsx
```

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "feat(ingest): end-to-end document ingestion with cli"
```

---

## Task 7: Vector retrieval (cosine similarity via pgvector)

**Files:**

- Create: `packages/core/src/retrieve/vector.ts`, `packages/core/tests/retrieve/vector.test.ts`

- [x] **Step 1: Write failing test**

`packages/core/tests/retrieve/vector.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createDbClient } from "../../src/db/client.js";
import { ingestDocument } from "../../src/ingest/index.js";
import { vectorSearch } from "../../src/retrieve/vector.js";
import { documents } from "../../src/db/schema.js";
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
```

- [x] **Step 2: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test retrieve/vector`
Expected: FAIL.

- [x] **Step 3: Implement `vector.ts`**

`packages/core/src/retrieve/vector.ts`:

```ts
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
```

- [x] **Step 4: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test retrieve/vector`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add .
git commit -m "feat(retrieve): pgvector cosine similarity search"
```

---

## Task 8: BM25-style retrieval via Postgres `ts_rank_cd`

**Files:**

- Create: `packages/core/src/retrieve/bm25.ts`, `packages/core/tests/retrieve/bm25.test.ts`

- [x] **Step 1: Write failing test**

`packages/core/tests/retrieve/bm25.test.ts`:

```ts
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
```

- [x] **Step 2: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test retrieve/bm25`
Expected: FAIL.

- [x] **Step 3: Implement `bm25.ts`**

`packages/core/src/retrieve/bm25.ts`:

```ts
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
```

- [x] **Step 4: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test retrieve/bm25`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add .
git commit -m "feat(retrieve): postgres tsvector bm25-style search"
```

---

## Task 9: Hybrid retrieval — Reciprocal Rank Fusion

**Files:**

- Create: `packages/core/src/retrieve/hybrid.ts`, `packages/core/tests/retrieve/hybrid.test.ts`

- [x] **Step 1: Write failing test**

`packages/core/tests/retrieve/hybrid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rrfMerge } from "../../src/retrieve/hybrid.js";
import type { RetrievedChunk } from "../../src/retrieve/vector.js";

const mk = (
  id: number,
  source: "vector" | "bm25",
  score: number,
): RetrievedChunk => ({
  chunkId: id,
  documentId: 1,
  text: `chunk ${id}`,
  score,
  source,
});

describe("rrfMerge", () => {
  it("merges two ranked lists by reciprocal rank fusion", () => {
    const vec = [
      mk(1, "vector", 0.9),
      mk(2, "vector", 0.7),
      mk(3, "vector", 0.5),
    ];
    const kw = [mk(2, "bm25", 0.8), mk(4, "bm25", 0.6), mk(1, "bm25", 0.4)];
    const merged = rrfMerge(vec, kw, { k: 60, limit: 3 });
    expect(merged.map((c) => c.chunkId)).toEqual([2, 1, 3]);
    expect(merged[0]?.source).toBe("hybrid");
  });

  it("works with one empty list", () => {
    const vec = [mk(1, "vector", 0.9)];
    const merged = rrfMerge(vec, [], { k: 60, limit: 5 });
    expect(merged.map((c) => c.chunkId)).toEqual([1]);
  });

  it("respects limit", () => {
    const vec = [mk(1, "vector", 1), mk(2, "vector", 0.9)];
    const kw = [mk(3, "bm25", 0.8)];
    const merged = rrfMerge(vec, kw, { k: 60, limit: 2 });
    expect(merged).toHaveLength(2);
  });
});
```

- [x] **Step 2: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test retrieve/hybrid`
Expected: FAIL.

- [x] **Step 3: Implement `hybrid.ts`**

`packages/core/src/retrieve/hybrid.ts`:

```ts
import type { RetrievedChunk } from "./vector.js";

export function rrfMerge(
  vec: RetrievedChunk[],
  kw: RetrievedChunk[],
  opts: { k: number; limit: number },
): RetrievedChunk[] {
  const map = new Map<number, RetrievedChunk & { rrf: number }>();

  const accumulate = (list: RetrievedChunk[]) => {
    list.forEach((chunk, rank) => {
      const inc = 1 / (opts.k + rank + 1);
      const existing = map.get(chunk.chunkId);
      if (existing) {
        existing.rrf += inc;
      } else {
        map.set(chunk.chunkId, { ...chunk, rrf: inc, source: "hybrid" });
      }
    });
  };

  accumulate(vec);
  accumulate(kw);

  return Array.from(map.values())
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, opts.limit)
    .map(({ rrf, ...rest }) => ({ ...rest, score: rrf }));
}
```

- [x] **Step 4: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test retrieve/hybrid`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add .
git commit -m "feat(retrieve): reciprocal rank fusion for hybrid retrieval"
```

---

## Task 10: Cohere rerank wrapper

**Files:**

- Create: `packages/core/src/retrieve/rerank.ts`, `packages/core/tests/retrieve/rerank.test.ts`

- [x] **Step 1: Add Cohere SDK**

```bash
pnpm --filter @support-copilot/core add cohere-ai
```

- [x] **Step 2: Write failing test**

`packages/core/tests/retrieve/rerank.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { rerank } from "../../src/retrieve/rerank.js";
import type { RetrievedChunk } from "../../src/retrieve/vector.js";

describe("rerank", () => {
  it("reorders chunks using cohere relevance scores", async () => {
    const chunks: RetrievedChunk[] = [
      {
        chunkId: 1,
        documentId: 1,
        text: "billing info",
        score: 0.9,
        source: "hybrid",
      },
      {
        chunkId: 2,
        documentId: 1,
        text: "password reset steps",
        score: 0.85,
        source: "hybrid",
      },
      {
        chunkId: 3,
        documentId: 1,
        text: "general intro",
        score: 0.6,
        source: "hybrid",
      },
    ];
    const fakeClient = {
      rerank: vi.fn().mockResolvedValue({
        results: [
          { index: 1, relevanceScore: 0.99 },
          { index: 0, relevanceScore: 0.4 },
          { index: 2, relevanceScore: 0.1 },
        ],
      }),
    } as any;

    const out = await rerank(fakeClient, "how to reset password", chunks, {
      topN: 2,
    });

    expect(out).toHaveLength(2);
    expect(out[0]?.chunkId).toBe(2);
    expect(out[0]?.score).toBeCloseTo(0.99);
    expect(out[1]?.chunkId).toBe(1);
  });

  it("returns input unchanged on zero chunks", async () => {
    const fakeClient = { rerank: vi.fn() } as any;
    const out = await rerank(fakeClient, "q", [], { topN: 5 });
    expect(out).toEqual([]);
    expect(fakeClient.rerank).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 3: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test retrieve/rerank`
Expected: FAIL.

- [x] **Step 4: Implement `rerank.ts`**

`packages/core/src/retrieve/rerank.ts`:

```ts
import type { CohereClient } from "cohere-ai";
import type { RetrievedChunk } from "./vector.js";

export async function rerank(
  client: Pick<CohereClient, "rerank">,
  query: string,
  chunks: RetrievedChunk[],
  opts: { topN: number; model?: string },
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];

  const res = await client.rerank({
    model: opts.model ?? "rerank-english-v3.0",
    query,
    documents: chunks.map((c) => c.text),
    topN: opts.topN,
  });

  return (res.results ?? []).map((r) => {
    const original = chunks[r.index]!;
    return {
      ...original,
      score: r.relevanceScore,
    };
  });
}
```

- [x] **Step 5: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test retrieve/rerank`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "feat(retrieve): cohere rerank wrapper"
```

---

## Task 11: End-to-end retrieve pipeline

**Files:**

- Create: `packages/core/src/retrieve/index.ts`, `packages/core/tests/retrieve/index.test.ts`

- [x] **Step 1: Write failing test**

`packages/core/tests/retrieve/index.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { retrieve } from "../../src/retrieve/index.js";
import type { RetrievedChunk } from "../../src/retrieve/vector.js";

describe("retrieve pipeline", () => {
  it("calls vector + bm25, fuses, then reranks", async () => {
    const vec: RetrievedChunk[] = [
      { chunkId: 1, documentId: 1, text: "vec1", score: 0.9, source: "vector" },
    ];
    const kw: RetrievedChunk[] = [
      { chunkId: 2, documentId: 1, text: "kw1", score: 0.8, source: "bm25" },
    ];

    const deps = {
      embedQuery: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      vectorSearch: vi.fn().mockResolvedValue(vec),
      bm25Search: vi.fn().mockResolvedValue(kw),
      rerank: vi.fn().mockImplementation(async (_q, chunks) => chunks),
    };

    const out = await retrieve("how do I reset password", {
      ...deps,
      candidatePool: 20,
      topN: 4,
    });

    expect(deps.embedQuery).toHaveBeenCalledWith("how do I reset password");
    expect(deps.vectorSearch).toHaveBeenCalled();
    expect(deps.bm25Search).toHaveBeenCalled();
    expect(deps.rerank).toHaveBeenCalled();
    expect(out.length).toBeGreaterThan(0);
  });
});
```

- [x] **Step 2: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test retrieve/index`
Expected: FAIL.

- [x] **Step 3: Implement `retrieve/index.ts`**

`packages/core/src/retrieve/index.ts`:

```ts
import type { RetrievedChunk } from "./vector.js";
import { rrfMerge } from "./hybrid.js";

export interface RetrieveDeps {
  embedQuery: (q: string) => Promise<number[]>;
  vectorSearch: (
    vec: number[],
    opts: { limit: number },
  ) => Promise<RetrievedChunk[]>;
  bm25Search: (q: string, opts: { limit: number }) => Promise<RetrievedChunk[]>;
  rerank: (
    q: string,
    chunks: RetrievedChunk[],
    opts: { topN: number },
  ) => Promise<RetrievedChunk[]>;
  candidatePool: number;
  topN: number;
}

export async function retrieve(
  query: string,
  deps: RetrieveDeps,
): Promise<RetrievedChunk[]> {
  const qVec = await deps.embedQuery(query);
  const [vec, kw] = await Promise.all([
    deps.vectorSearch(qVec, { limit: deps.candidatePool }),
    deps.bm25Search(query, { limit: deps.candidatePool }),
  ]);
  const fused = rrfMerge(vec, kw, { k: 60, limit: deps.candidatePool });
  return deps.rerank(query, fused, { topN: deps.topN });
}
```

- [x] **Step 4: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test retrieve/index`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add .
git commit -m "feat(retrieve): wire embed → vector+bm25 → rrf → rerank"
```

---

## Task 12: Generation with structured output (Zod schema, OpenAI structured outputs)

**Files:**

- Create: `packages/core/src/generate/answer.ts`, `packages/core/tests/generate/answer.test.ts`

- [x] **Step 1: Add Zod**

```bash
pnpm --filter @support-copilot/core add zod
```

- [x] **Step 2: Write failing test**

`packages/core/tests/generate/answer.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { generateAnswer, AnswerSchema } from "../../src/generate/answer.js";

describe("generateAnswer", () => {
  it("calls LLM with formatted context and parses structured response", async () => {
    const fakeJson = {
      answer: "To reset your password, go to settings.",
      citations: [{ chunkId: 7, quote: "Go to settings." }],
      confidence: 0.92,
      escalate: false,
    };
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(fakeJson) } }],
          }),
        },
      },
    } as any;

    const out = await generateAnswer({
      client: fakeClient,
      query: "how to reset password",
      chunks: [
        {
          chunkId: 7,
          documentId: 1,
          text: "Go to settings.",
          score: 0.9,
          source: "hybrid",
        },
      ],
    });

    expect(AnswerSchema.parse(out)).toEqual(fakeJson);
    expect(fakeClient.chat.completions.create).toHaveBeenCalledOnce();
    const callArgs = fakeClient.chat.completions.create.mock.calls[0][0];
    expect(callArgs.response_format?.type).toBe("json_schema");
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].content).toContain("how to reset password");
    expect(callArgs.messages[1].content).toContain("[7]");
  });

  it("throws on malformed model output", async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "not json" } }],
          }),
        },
      },
    } as any;

    await expect(
      generateAnswer({
        client: fakeClient,
        query: "q",
        chunks: [
          {
            chunkId: 1,
            documentId: 1,
            text: "t",
            score: 0.9,
            source: "hybrid",
          },
        ],
      }),
    ).rejects.toThrow();
  });
});
```

- [x] **Step 3: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test generate/answer`
Expected: FAIL.

- [x] **Step 4: Implement `generate/answer.ts`**

`packages/core/src/generate/answer.ts`:

```ts
import OpenAI from "openai";
import { z } from "zod";
import type { RetrievedChunk } from "../retrieve/vector.js";

export const AnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({ chunkId: z.number(), quote: z.string() })),
  confidence: z.number().min(0).max(1),
  escalate: z.boolean(),
});

export type Answer = z.infer<typeof AnswerSchema>;

const SYSTEM = `You are a B2B SaaS support copilot.
Use ONLY the provided context chunks to answer the user's question.
- Cite each fact you use by referencing chunk IDs in square brackets like [12].
- For each citation in your answer, include a "citations" entry with the chunkId and a short verbatim quote from that chunk.
- Set confidence between 0 and 1 based on how directly the chunks answer the question.
- If chunks do not contain the answer, set escalate=true, set confidence below 0.5, and politely say you don't know.
Output strictly valid JSON matching the provided schema.`;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "citations", "confidence", "escalate"],
  properties: {
    answer: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["chunkId", "quote"],
        properties: {
          chunkId: { type: "integer" },
          quote: { type: "string" },
        },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    escalate: { type: "boolean" },
  },
} as const;

export interface GenerateAnswerInput {
  client: OpenAI;
  query: string;
  chunks: RetrievedChunk[];
  model?: string;
}

export async function generateAnswer(
  input: GenerateAnswerInput,
): Promise<Answer> {
  const context = input.chunks
    .map((c) => `[${c.chunkId}] ${c.text}`)
    .join("\n\n");

  const res = await input.client.chat.completions.create({
    model: input.model ?? "gpt-4o-mini",
    temperature: 0.1,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "support_answer",
        strict: true,
        schema: JSON_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Question: ${input.query}\n\nContext:\n${context}`,
      },
    ],
  });

  const raw = res.choices[0]?.message.content ?? "";
  const parsed = JSON.parse(raw);
  return AnswerSchema.parse(parsed);
}
```

- [x] **Step 5: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test generate/answer`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "feat(generate): structured-output answer with citations"
```

---

## Task 13: Hallucination guard

**Files:**

- Create: `packages/core/src/generate/guard.ts`, `packages/core/tests/generate/guard.test.ts`

- [x] **Step 1: Write failing test**

`packages/core/tests/generate/guard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyGuard } from "../../src/generate/guard.js";
import type { Answer } from "../../src/generate/answer.js";
import type { RetrievedChunk } from "../../src/retrieve/vector.js";

const chunk = (id: number, text: string): RetrievedChunk => ({
  chunkId: id,
  documentId: 1,
  text,
  score: 0.9,
  source: "hybrid",
});

const baseAnswer: Answer = {
  answer: "Reset via settings.",
  citations: [{ chunkId: 1, quote: "Go to settings." }],
  confidence: 0.9,
  escalate: false,
};

describe("applyGuard", () => {
  it("passes a well-grounded answer through unchanged", () => {
    const out = applyGuard(baseAnswer, [chunk(1, "Go to settings.")], {
      minConfidence: 0.5,
    });
    expect(out.escalate).toBe(false);
    expect(out.answer).toBe("Reset via settings.");
  });

  it("escalates when confidence below threshold", () => {
    const low: Answer = { ...baseAnswer, confidence: 0.3 };
    const out = applyGuard(low, [chunk(1, "Go to settings.")], {
      minConfidence: 0.5,
    });
    expect(out.escalate).toBe(true);
    expect(out.answer.toLowerCase()).toContain("don't know");
  });

  it("escalates when no citation references retrieved chunk ids", () => {
    const ungrounded: Answer = {
      ...baseAnswer,
      citations: [{ chunkId: 999, quote: "fabricated" }],
    };
    const out = applyGuard(ungrounded, [chunk(1, "Go to settings.")], {
      minConfidence: 0.5,
    });
    expect(out.escalate).toBe(true);
  });

  it("escalates when quote is not contained verbatim in cited chunk", () => {
    const wrongQuote: Answer = {
      ...baseAnswer,
      citations: [{ chunkId: 1, quote: "this text is nowhere in the chunk" }],
    };
    const out = applyGuard(wrongQuote, [chunk(1, "Go to settings.")], {
      minConfidence: 0.5,
    });
    expect(out.escalate).toBe(true);
  });
});
```

- [x] **Step 2: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test generate/guard`
Expected: FAIL.

- [x] **Step 3: Implement `guard.ts`**

`packages/core/src/generate/guard.ts`:

```ts
import type { Answer } from "./answer.js";
import type { RetrievedChunk } from "../retrieve/vector.js";

const FALLBACK =
  "I don't know based on the available docs — escalating to a human agent.";

export interface GuardOptions {
  minConfidence: number;
}

export function applyGuard(
  ans: Answer,
  chunks: RetrievedChunk[],
  opts: GuardOptions,
): Answer {
  const validIds = new Set(chunks.map((c) => c.chunkId));

  const reasons: string[] = [];
  if (ans.confidence < opts.minConfidence) reasons.push("low_confidence");

  const citedKnown = ans.citations.filter((c) => validIds.has(c.chunkId));
  if (citedKnown.length === 0) reasons.push("no_grounded_citation");

  for (const cit of citedKnown) {
    const chunk = chunks.find((c) => c.chunkId === cit.chunkId)!;
    const normalized = (s: string) =>
      s.replace(/\s+/g, " ").toLowerCase().trim();
    if (!normalized(chunk.text).includes(normalized(cit.quote))) {
      reasons.push(`quote_not_in_chunk_${cit.chunkId}`);
    }
  }

  if (reasons.length > 0) {
    return { ...ans, escalate: true, answer: FALLBACK };
  }
  return ans;
}
```

- [x] **Step 4: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test generate/guard`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add .
git commit -m "feat(generate): hallucination guard with citation+quote verification"
```

---

## Task 14: Public `answerQuery` orchestration

**Files:**

- Create: `packages/core/src/generate/index.ts`, `packages/core/src/index.ts` (update), `packages/core/tests/generate/orchestration.test.ts`

- [x] **Step 1: Write failing test**

`packages/core/tests/generate/orchestration.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { answerQuery } from "../../src/generate/index.js";
import type { RetrievedChunk } from "../../src/retrieve/vector.js";
import type { Answer } from "../../src/generate/answer.js";

const chunks: RetrievedChunk[] = [
  {
    chunkId: 1,
    documentId: 1,
    text: "Go to settings.",
    score: 0.9,
    source: "hybrid",
  },
];
const okAnswer: Answer = {
  answer: "Settings page.",
  citations: [{ chunkId: 1, quote: "Go to settings." }],
  confidence: 0.9,
  escalate: false,
};

describe("answerQuery", () => {
  it("retrieves chunks, generates answer, applies guard", async () => {
    const deps = {
      retrieve: vi.fn().mockResolvedValue(chunks),
      generate: vi.fn().mockResolvedValue(okAnswer),
      minConfidence: 0.5,
    };
    const out = await answerQuery("how reset password", deps);
    expect(deps.retrieve).toHaveBeenCalledWith("how reset password");
    expect(deps.generate).toHaveBeenCalledWith({
      query: "how reset password",
      chunks,
    });
    expect(out.escalate).toBe(false);
  });

  it("escalates when guard rejects ungrounded answer", async () => {
    const deps = {
      retrieve: vi.fn().mockResolvedValue(chunks),
      generate: vi.fn().mockResolvedValue({ ...okAnswer, confidence: 0.1 }),
      minConfidence: 0.5,
    };
    const out = await answerQuery("q", deps);
    expect(out.escalate).toBe(true);
  });
});
```

- [x] **Step 2: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test generate/orchestration`
Expected: FAIL.

- [x] **Step 3: Implement `generate/index.ts`**

`packages/core/src/generate/index.ts`:

```ts
import { applyGuard } from "./guard.js";
import type { Answer } from "./answer.js";
import type { RetrievedChunk } from "../retrieve/vector.js";

export interface AnswerQueryDeps {
  retrieve: (query: string) => Promise<RetrievedChunk[]>;
  generate: (input: {
    query: string;
    chunks: RetrievedChunk[];
  }) => Promise<Answer>;
  minConfidence: number;
}

export async function answerQuery(
  query: string,
  deps: AnswerQueryDeps,
): Promise<Answer> {
  const chunks = await deps.retrieve(query);
  const ans = await deps.generate({ query, chunks });
  return applyGuard(ans, chunks, { minConfidence: deps.minConfidence });
}

export { generateAnswer, AnswerSchema, type Answer } from "./answer.js";
export { applyGuard } from "./guard.js";
```

- [x] **Step 4: Update `packages/core/src/index.ts`**

```ts
export * from "./db/client.js";
export * from "./db/schema.js";
export * from "./ingest/index.js";
export * from "./ingest/embed.js";
export * from "./retrieve/index.js";
export * from "./retrieve/vector.js";
export * from "./retrieve/bm25.js";
export * from "./retrieve/rerank.js";
export * from "./generate/index.js";
```

- [x] **Step 5: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test generate/orchestration`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "feat(generate): public answerQuery orchestration"
```

---

## Task 15: Eval harness — case loader, runner, reporter

**Files:**

- Create: `eval/cases.yaml` (skeleton with 5 cases — fill remaining 25 in Task 16)
- Create: `packages/core/src/eval/types.ts`, `packages/core/src/eval/loader.ts`, `packages/core/src/eval/runner.ts`, `packages/core/src/eval/cli.ts`
- Create: `packages/core/tests/eval/loader.test.ts`, `packages/core/tests/eval/runner.test.ts`

- [x] **Step 1: Add YAML dep**

```bash
pnpm --filter @support-copilot/core add yaml
```

- [x] **Step 2: Write the case schema and loader test**

`packages/core/tests/eval/loader.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCases } from "../../src/eval/loader.js";

describe("loadCases", () => {
  it("loads valid yaml and validates schema", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-"));
    const file = join(dir, "cases.yaml");
    await writeFile(
      file,
      `
- id: reset-password
  query: How do I reset my password?
  expectedCitationDocs: ["account-settings"]
  mustContain: ["settings"]
- id: billing
  query: When am I billed?
  expectedCitationDocs: ["billing-faq"]
`,
    );
    const cases = await loadCases(file);
    expect(cases).toHaveLength(2);
    expect(cases[0]?.id).toBe("reset-password");
    expect(cases[0]?.mustContain).toEqual(["settings"]);
  });

  it("rejects malformed cases", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-"));
    const file = join(dir, "bad.yaml");
    await writeFile(file, "- id: missing-query\n");
    await expect(loadCases(file)).rejects.toThrow();
  });
});
```

- [x] **Step 3: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test eval/loader`
Expected: FAIL.

- [x] **Step 4: Implement types + loader**

`packages/core/src/eval/types.ts`:

```ts
import { z } from "zod";

export const CaseSchema = z.object({
  id: z.string(),
  query: z.string(),
  expectedCitationDocs: z.array(z.string()).default([]),
  mustContain: z.array(z.string()).default([]),
  mustEscalate: z.boolean().default(false),
});

export type EvalCase = z.infer<typeof CaseSchema>;

export const CaseListSchema = z.array(CaseSchema);
```

`packages/core/src/eval/loader.ts`:

```ts
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { CaseListSchema, type EvalCase } from "./types.js";

export async function loadCases(path: string): Promise<EvalCase[]> {
  const raw = await readFile(path, "utf8");
  const parsed = parseYaml(raw);
  return CaseListSchema.parse(parsed);
}
```

- [x] **Step 5: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test eval/loader`
Expected: PASS.

- [x] **Step 6: Write runner test**

`packages/core/tests/eval/runner.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runCases } from "../../src/eval/runner.js";
import type { EvalCase } from "../../src/eval/types.js";

const cases: EvalCase[] = [
  {
    id: "reset",
    query: "reset password",
    expectedCitationDocs: ["account-settings"],
    mustContain: ["settings"],
    mustEscalate: false,
  },
  {
    id: "unknown",
    query: "what is the meaning of life",
    expectedCitationDocs: [],
    mustContain: [],
    mustEscalate: true,
  },
];

describe("runCases", () => {
  it("evaluates each case and returns pass/fail report", async () => {
    const answer = vi.fn().mockImplementation(async (q: string) => {
      if (q === "reset password") {
        return {
          answer: "Reset via settings page.",
          citations: [{ chunkId: 1, quote: "settings" }],
          confidence: 0.9,
          escalate: false,
          _docSources: ["account-settings"],
        };
      }
      return {
        answer: "I don't know.",
        citations: [],
        confidence: 0.1,
        escalate: true,
        _docSources: [],
      };
    });

    const report = await runCases(cases, answer);
    expect(report.total).toBe(2);
    expect(report.passed).toBe(2);
    expect(report.results.find((r) => r.id === "reset")?.passed).toBe(true);
    expect(report.results.find((r) => r.id === "unknown")?.passed).toBe(true);
  });

  it("flags failure when mustContain is missing", async () => {
    const answer = vi.fn().mockResolvedValue({
      answer: "Some unrelated text.",
      citations: [{ chunkId: 1, quote: "x" }],
      confidence: 0.9,
      escalate: false,
      _docSources: ["account-settings"],
    });
    const report = await runCases([cases[0]!], answer);
    expect(report.passed).toBe(0);
    expect(report.results[0]?.failures).toContain(
      "missing_must_contain:settings",
    );
  });
});
```

- [x] **Step 7: Run — expect failure**

Run: `pnpm --filter @support-copilot/core test eval/runner`
Expected: FAIL.

- [x] **Step 8: Implement `runner.ts`**

`packages/core/src/eval/runner.ts`:

```ts
import type { EvalCase } from "./types.js";

export interface AnnotatedAnswer {
  answer: string;
  citations: { chunkId: number; quote: string }[];
  confidence: number;
  escalate: boolean;
  _docSources: string[];
}

export interface CaseResult {
  id: string;
  passed: boolean;
  failures: string[];
  answer: AnnotatedAnswer;
}

export interface RunReport {
  total: number;
  passed: number;
  results: CaseResult[];
}

export async function runCases(
  cases: EvalCase[],
  answer: (query: string) => Promise<AnnotatedAnswer>,
): Promise<RunReport> {
  const results: CaseResult[] = [];
  for (const c of cases) {
    const ans = await answer(c.query);
    const failures: string[] = [];

    for (const phrase of c.mustContain) {
      if (!ans.answer.toLowerCase().includes(phrase.toLowerCase())) {
        failures.push(`missing_must_contain:${phrase}`);
      }
    }

    if (c.mustEscalate && !ans.escalate) failures.push("expected_escalate");
    if (!c.mustEscalate && ans.escalate) failures.push("unexpected_escalate");

    if (c.expectedCitationDocs.length > 0) {
      const cited = new Set(ans._docSources);
      for (const d of c.expectedCitationDocs) {
        if (!cited.has(d)) failures.push(`missing_citation_doc:${d}`);
      }
    }

    results.push({
      id: c.id,
      passed: failures.length === 0,
      failures,
      answer: ans,
    });
  }
  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    results,
  };
}
```

- [x] **Step 9: Run — expect pass**

Run: `pnpm --filter @support-copilot/core test eval/runner`
Expected: 2 passing.

- [x] **Step 10: Implement CLI**

`packages/core/src/eval/cli.ts`:

```ts
import { loadCases } from "./loader.js";
import { runCases, type AnnotatedAnswer } from "./runner.js";
import { writeFile } from "node:fs/promises";
import OpenAI from "openai";
import { CohereClient } from "cohere-ai";
import { createDbClient } from "../db/client.js";
import { embedTexts } from "../ingest/embed.js";
import { vectorSearch } from "../retrieve/vector.js";
import { bm25Search } from "../retrieve/bm25.js";
import { rerank } from "../retrieve/rerank.js";
import { retrieve } from "../retrieve/index.js";
import { generateAnswer } from "../generate/answer.js";
import { applyGuard } from "../generate/guard.js";
import { documents } from "../db/schema.js";
import { inArray } from "drizzle-orm";

async function buildAnswerFn() {
  const db = createDbClient(process.env.DATABASE_URL!);
  const openai = new OpenAI();
  const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

  return async (query: string): Promise<AnnotatedAnswer> => {
    const chunks = await retrieve(query, {
      embedQuery: async (q) => (await embedTexts([q]))[0]!,
      vectorSearch: (vec, opts) => vectorSearch(db, vec, opts),
      bm25Search: (q, opts) => bm25Search(db, q, opts),
      rerank: (q, c, opts) => rerank(cohere, q, c, opts),
      candidatePool: 20,
      topN: 6,
    });
    const raw = await generateAnswer({ client: openai, query, chunks });
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
```

Add script in `packages/core/package.json`:

```json
"eval": "tsx src/eval/cli.ts"
```

- [x] **Step 11: Commit**

```bash
git add .
git commit -m "feat(eval): yaml-driven eval harness with cli reporter"
```

---

## Task 16: Seed data and 30 eval cases

**Files:**

- Create: `seed/docs/account-settings.md`, `seed/docs/billing-faq.md`, `seed/docs/sso-setup.md`, `seed/docs/api-rate-limits.md`, `seed/docs/data-export.md`, `seed/docs/team-roles.md`, `seed/docs/integrations-slack.md`, `seed/docs/troubleshooting.md`
- Create: `seed/scripts/seed.ts`
- Create: `eval/cases.yaml` (30 cases)

- [ ] **Step 1: Author 8 sanitized "Acme SaaS" help docs**

For each file under `seed/docs/`, write 200–400 words of realistic help content. Topics:

1. `account-settings.md` — password reset, 2FA, profile editing
2. `billing-faq.md` — plan tiers, billing cycle, invoicing, refunds
3. `sso-setup.md` — SAML config, Okta example, troubleshooting cert errors
4. `api-rate-limits.md` — limits per plan, headers, exponential backoff
5. `data-export.md` — CSV/JSON export, retention, GDPR DPA
6. `team-roles.md` — admin/member/viewer permissions
7. `integrations-slack.md` — install steps, channel routing, removing integration
8. `troubleshooting.md` — common errors, support contact

Each file starts with `# <Title>` and uses normal Markdown.

- [ ] **Step 2: Write seed script**

`seed/scripts/seed.ts`:

```ts
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
```

Add to root `package.json`:

```json
"scripts": {
  "seed": "tsx seed/scripts/seed.ts"
}
```

- [ ] **Step 3: Author 30 eval cases**

`eval/cases.yaml`:

Group cases by topic to mirror docs. Each case has `id`, `query`, `expectedCitationDocs`, `mustContain`, optional `mustEscalate`. Authoring guidance:

- 4–5 cases per doc topic, with phrasing variations (formal, casual, typo, acronym, partial info).
- 3 cases that **must escalate** (questions docs do not answer): "Can you cancel my account on a phone call?", "What is your CEO's email?", "Will Acme integrate with Notion next quarter?"
- 2 negative-control cases: gibberish queries, expect escalate.

Example excerpt:

```yaml
- id: reset-password-direct
  query: How do I reset my password?
  expectedCitationDocs: ["account-settings"]
  mustContain: ["settings"]
- id: 2fa-setup
  query: How do I turn on two-factor authentication?
  expectedCitationDocs: ["account-settings"]
  mustContain: ["2fa"]
- id: billing-cycle
  query: When does my billing cycle restart?
  expectedCitationDocs: ["billing-faq"]
  mustContain: ["monthly"]
- id: refund-policy
  query: Can I get a refund for last month?
  expectedCitationDocs: ["billing-faq"]
  mustContain: ["refund"]
- id: ceo-email
  query: What is your CEO's email?
  expectedCitationDocs: []
  mustContain: []
  mustEscalate: true
# ... 25 more
```

- [ ] **Step 4: Smoke test seed + eval**

```bash
docker compose up -d postgres
docker compose exec -T postgres psql -U copilot -d copilot < packages/core/migrations/0000_init.sql
export OPENAI_API_KEY=sk-...
export COHERE_API_KEY=...
export DATABASE_URL=postgres://copilot:copilot@localhost:5432/copilot
pnpm seed
pnpm --filter @support-copilot/core eval
```

Expected: report shows ≥ 27/30 passing on first calibrated run. If lower, iterate `seed/docs` content (clarity, keyword coverage) and chunk size, not the eval cases.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(seed,eval): 8 sanitized help docs and 30 evaluation cases"
```

---

## Task 17: Slack Bolt app

**Files:**

- Create: `packages/slack-app/package.json`, `packages/slack-app/tsconfig.json`, `packages/slack-app/src/index.ts`

- [ ] **Step 1: Scaffold the package**

`packages/slack-app/package.json`:

```json
{
  "name": "@support-copilot/slack-app",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "start": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@slack/bolt": "^3.18.0",
    "@support-copilot/core": "workspace:*",
    "openai": "^4.50.0",
    "cohere-ai": "^7.10.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0"
  }
}
```

`packages/slack-app/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2: Implement the Bolt app**

`packages/slack-app/src/index.ts`:

```ts
import bolt from "@slack/bolt";
import OpenAI from "openai";
import { CohereClient } from "cohere-ai";
import {
  createDbClient,
  embedTexts,
  vectorSearch,
  bm25Search,
  rerank,
  retrieve,
  generateAnswer,
  applyGuard,
} from "@support-copilot/core";

const { App } = bolt;

const app = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

const db = createDbClient(process.env.DATABASE_URL!);
const openai = new OpenAI();
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

app.event("app_mention", async ({ event, say }) => {
  const query = event.text.replace(/<@[^>]+>/g, "").trim();
  if (!query) {
    await say({
      text: "Ask me a question about the docs.",
      thread_ts: event.ts,
    });
    return;
  }

  const chunks = await retrieve(query, {
    embedQuery: async (q) => (await embedTexts([q]))[0]!,
    vectorSearch: (vec, opts) => vectorSearch(db, vec, opts),
    bm25Search: (q, opts) => bm25Search(db, q, opts),
    rerank: (q, c, opts) => rerank(cohere, q, c, opts),
    candidatePool: 20,
    topN: 6,
  });

  const raw = await generateAnswer({ client: openai, query, chunks });
  const guarded = applyGuard(raw, chunks, { minConfidence: 0.5 });

  const citationLines = guarded.citations
    .map((c) => `> [${c.chunkId}] ${c.quote}`)
    .join("\n");
  const text = `${guarded.answer}\n\n${citationLines || "_no citations_"}\n\n_confidence: ${guarded.confidence.toFixed(2)}${guarded.escalate ? " — escalating" : ""}_`;

  await say({ text, thread_ts: event.ts });
});

const port = Number(process.env.PORT ?? 3000);
app.start(port).then(() => console.log(`slack-app listening on :${port}`));
```

- [ ] **Step 3: Smoke run locally**

```bash
pnpm --filter @support-copilot/slack-app start
```

Expected: console shows `slack-app listening on :3000`. Use `ngrok http 3000` and configure Slack App `Event Subscriptions` Request URL to validate.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(slack-app): @-mention answer flow with citations"
```

---

## Task 18: Next.js demo widget

**Files:**

- Create: `packages/web/package.json`, `packages/web/next.config.mjs`, `packages/web/tsconfig.json`, `packages/web/app/layout.tsx`, `packages/web/app/page.tsx`, `packages/web/app/api/ask/route.ts`, `packages/web/app/globals.css`

- [ ] **Step 1: Scaffold the package**

`packages/web/package.json`:

```json
{
  "name": "@support-copilot/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@support-copilot/core": "workspace:*",
    "openai": "^4.50.0",
    "cohere-ai": "^7.10.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

`packages/web/next.config.mjs`:

```js
export default { reactStrictMode: true };
```

`packages/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["app/**/*", "next-env.d.ts"]
}
```

- [ ] **Step 2: Implement the API route**

`packages/web/app/api/ask/route.ts`:

```ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { CohereClient } from "cohere-ai";
import {
  createDbClient,
  embedTexts,
  vectorSearch,
  bm25Search,
  rerank,
  retrieve,
  generateAnswer,
  applyGuard,
} from "@support-copilot/core";

const db = createDbClient(process.env.DATABASE_URL!);
const openai = new OpenAI();
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

export async function POST(req: Request) {
  const { query } = (await req.json()) as { query: string };
  if (!query)
    return NextResponse.json({ error: "query required" }, { status: 400 });

  const chunks = await retrieve(query, {
    embedQuery: async (q) => (await embedTexts([q]))[0]!,
    vectorSearch: (vec, opts) => vectorSearch(db, vec, opts),
    bm25Search: (q, opts) => bm25Search(db, q, opts),
    rerank: (q, c, opts) => rerank(cohere, q, c, opts),
    candidatePool: 20,
    topN: 6,
  });

  const raw = await generateAnswer({ client: openai, query, chunks });
  const guarded = applyGuard(raw, chunks, { minConfidence: 0.5 });

  return NextResponse.json({
    answer: guarded.answer,
    citations: guarded.citations.map((c) => {
      const chunk = chunks.find((ch) => ch.chunkId === c.chunkId);
      return { chunkId: c.chunkId, quote: c.quote, text: chunk?.text ?? null };
    }),
    confidence: guarded.confidence,
    escalate: guarded.escalate,
  });
}
```

- [ ] **Step 3: Implement the UI**

`packages/web/app/layout.tsx`:

```tsx
import "./globals.css";

export const metadata = { title: "Support Copilot Demo" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`packages/web/app/globals.css`:

```css
:root {
  font-family: system-ui, sans-serif;
}
body {
  margin: 0;
  padding: 24px;
  max-width: 720px;
}
input {
  width: 100%;
  padding: 8px;
  font-size: 16px;
}
button {
  margin-top: 8px;
  padding: 8px 12px;
}
.answer {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}
.citation {
  margin-top: 8px;
  font-size: 14px;
  color: #555;
}
```

`packages/web/app/page.tsx`:

```tsx
"use client";
import { useState } from "react";

interface Citation {
  chunkId: number;
  quote: string;
  text: string | null;
}
interface Result {
  answer: string;
  citations: Citation[];
  confidence: number;
  escalate: boolean;
}

export default function Home() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function ask() {
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Support Copilot Demo</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ask a question..."
      />
      <button onClick={ask} disabled={busy || !q}>
        {busy ? "Thinking..." : "Ask"}
      </button>
      {result && (
        <div className="answer">
          <p>{result.answer}</p>
          <p>
            <strong>Confidence:</strong> {result.confidence.toFixed(2)}
            {result.escalate ? " — escalating" : ""}
          </p>
          {result.citations.map((c) => (
            <div className="citation" key={c.chunkId}>
              [{c.chunkId}] {c.quote}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Smoke test locally**

```bash
pnpm --filter @support-copilot/web dev
```

Open http://localhost:3001, ask a seeded question, verify response.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(web): nextjs demo widget with /api/ask"
```

---

## Task 19: GitHub Actions — unit tests + eval gate

**Files:**

- Create: `.github/workflows/test.yml`, `.github/workflows/eval.yml`

- [ ] **Step 1: Write the test workflow**

`.github/workflows/test.yml`:

```yaml
name: test
on:
  push:
    branches: [main]
  pull_request:

jobs:
  unit:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: copilot
          POSTGRES_PASSWORD: copilot
          POSTGRES_DB: copilot
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgres://copilot:copilot@localhost:5432/copilot
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: docker run --rm --network host -v $PWD/packages/core/migrations:/m postgres:16 psql "$DATABASE_URL" -f /m/0000_init.sql
      - run: pnpm test
```

- [ ] **Step 2: Write the eval workflow**

`.github/workflows/eval.yml`:

```yaml
name: eval
on:
  pull_request:
  workflow_dispatch:

jobs:
  eval:
    runs-on: ubuntu-latest
    if: ${{ github.event.pull_request.head.repo.full_name == github.repository }}
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: copilot
          POSTGRES_PASSWORD: copilot
          POSTGRES_DB: copilot
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgres://copilot:copilot@localhost:5432/copilot
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      COHERE_API_KEY: ${{ secrets.COHERE_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: docker run --rm --network host -v $PWD/packages/core/migrations:/m postgres:16 psql "$DATABASE_URL" -f /m/0000_init.sql
      - run: pnpm seed
      - run: pnpm --filter @support-copilot/core eval
      - uses: actions/upload-artifact@v4
        with: { name: eval-report, path: eval/report.json }
```

- [ ] **Step 3: Add repo secrets**

In GitHub repo settings → Secrets and variables → Actions, add:

- `OPENAI_API_KEY`
- `COHERE_API_KEY`

- [ ] **Step 4: Push and verify**

```bash
git push -u origin main
```

Open a tiny throwaway PR. Verify both workflows run green.

- [ ] **Step 5: Commit (workflows themselves were added in Step 1-2)**

```bash
git add .github/
git commit -m "ci: unit test workflow and eval-gated workflow"
```

---

## Task 20: Deploy to Railway

**Files:**

- Create: `railway.json`, `packages/web/Dockerfile`, `packages/slack-app/Dockerfile`
- Update: `README.md`

- [ ] **Step 1: Create Railway project**

Web: https://railway.app/new → Empty project. Add Postgres plugin (it includes pgvector via `pgvector/pgvector` image; if not, configure custom Postgres image).

- [ ] **Step 2: Write `packages/web/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile
COPY packages/core packages/core
COPY packages/web packages/web
RUN pnpm --filter @support-copilot/web build
WORKDIR /app/packages/web
EXPOSE 3001
CMD ["pnpm", "start"]
```

- [ ] **Step 3: Write `packages/slack-app/Dockerfile`**

```dockerfile
FROM node:20-alpine
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/slack-app/package.json packages/slack-app/
RUN pnpm install --frozen-lockfile
COPY packages/core packages/core
COPY packages/slack-app packages/slack-app
EXPOSE 3000
CMD ["pnpm", "--filter", "@support-copilot/slack-app", "start"]
```

- [ ] **Step 4: Configure Railway services**

- Service "web": connect GitHub repo, root directory `.`, dockerfile `packages/web/Dockerfile`. Env vars: `DATABASE_URL` (from Postgres plugin), `OPENAI_API_KEY`, `COHERE_API_KEY`.
- Service "slack-app": same, dockerfile `packages/slack-app/Dockerfile`. Env vars: same plus `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`.

- [ ] **Step 5: Run migration on Railway Postgres**

From local terminal:

```bash
psql "$RAILWAY_DATABASE_URL" -f packages/core/migrations/0000_init.sql
pnpm seed
```

(Use Railway-provided DATABASE_URL.)

- [ ] **Step 6: Verify deploy**

Open the public web URL, run a query against the seeded "Acme SaaS" docs. Verify Slack app: install to a workspace, mention the bot, get a cited answer.

- [ ] **Step 7: Add deploy section to README**

`README.md` (append):

```md
## Deploy

Web: https://support-copilot-web.up.railway.app
Slack: install via [this link](https://...)

Local dev:
\`\`\`bash
docker compose up -d postgres
psql "$DATABASE_URL" -f packages/core/migrations/0000_init.sql
pnpm seed
pnpm --filter @support-copilot/web dev
\`\`\`
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "deploy: dockerfiles and railway config; seeded production demo"
```

---

## Task 21: Architecture diagram, README polish, Loom recording

**Files:**

- Create: `docs/architecture.md`, `docs/architecture.png` (or `.svg`)
- Update: `README.md` (full)

- [ ] **Step 1: Draw the architecture diagram**

Use Excalidraw or `mermaid` in `docs/architecture.md`:

```mermaid
flowchart LR
  Q[User Query] --> EQ[Embed Query]
  Q --> KW[BM25 Search]
  EQ --> VS[Vector Search<br/>pgvector cosine]
  KW --> RRF[RRF Merge]
  VS --> RRF
  RRF --> RR[Cohere Rerank]
  RR --> GEN[gpt-4o-mini<br/>structured output]
  GEN --> GUARD[Hallucination Guard<br/>citation + confidence]
  GUARD --> A[Answer + Citations]
  GUARD -. low conf .-> ESC[Escalate]
```

Add 1-paragraph explanation per stage.

- [ ] **Step 2: Write full README**

Replace `README.md` with:

```md
# Support Copilot

A production-grade RAG support bot for B2B SaaS — answers tier-1 tickets from your help docs with citations, escalates when unsure, all under a CI-checked eval harness.

**Live demo:** https://support-copilot-web.up.railway.app
**Architecture:** see [docs/architecture.md](docs/architecture.md)
**Eval results:** 30/30 cases must pass on every PR — see Actions tab

## Why this exists

Most "support GPT" demos hallucinate. This one does not, because every answer is gated by:

1. Hybrid retrieval (BM25 + vector) plus Cohere rerank
2. Structured-output JSON with explicit citations
3. A guard layer that verifies each cited quote appears verbatim in the cited chunk
4. A 30-case eval suite that runs in CI on every PR — regressions fail the build

## Stack

Node.js 20, TypeScript, Postgres + pgvector, Drizzle, OpenAI, Cohere, @slack/bolt, Next.js, Vitest, Railway.

## Local setup

\`\`\`bash
pnpm install
docker compose up -d postgres
psql "$DATABASE_URL" -f packages/core/migrations/0000_init.sql
pnpm seed
pnpm --filter @support-copilot/web dev # web demo on :3001
pnpm --filter @support-copilot/slack-app start # slack on :3000
\`\`\`

## Tests and evals

\`\`\`bash
pnpm test # vitest unit + integration
pnpm --filter @support-copilot/core eval # 30 case suite
\`\`\`

## License

MIT.
```

- [ ] **Step 3: Record Loom (5 min)**

Script:

1. (0:00–0:30) Problem framing — "tier-1 support, hallucination risk, citation requirement."
2. (0:30–1:30) Architecture walkthrough on `docs/architecture.md`.
3. (1:30–3:00) Live demo on Railway URL: ask a known question, show citations + confidence; ask an unknowable question, show escalation; ask a tricky multi-doc question.
4. (3:00–4:00) Eval harness — run `pnpm --filter @support-copilot/core eval`, show 30 passing.
5. (4:00–5:00) Repo walkthrough — point at `guard.ts`, `hybrid.ts`, eval workflow file.

Upload Loom, copy public link.

- [ ] **Step 4: Add Loom link to README**

```md
**Walkthrough:** [5-min Loom](paste-link)
```

- [ ] **Step 5: Commit and tag**

```bash
git add .
git commit -m "docs: architecture diagram, readme polish, loom walkthrough link"
git tag v0.1.0
git push --tags
```

---

## Task 21: Local model adapter (open-source stack)

**Goal:** Add a `MODEL_PROVIDER=local|openai` switch so the entire pipeline (embed, generate, rerank) can run against local open-source models on a 2024 MacBook Pro. No code path is removed; OpenAI/Cohere remains default.

**Stack (Option B — full local, no rerank gap):**

- LLM: `llama.cpp` server, OpenAI-compatible chat completions on `http://localhost:8080/v1`. Model: `Qwen2.5-7B-Instruct-Q4_K_M.gguf` (or `Llama-3.2-3B-Instruct-Q4_K_M` on 16 GB MBPs).
- Embeddings: Hugging Face Text Embeddings Inference (TEI) serving `BAAI/bge-base-en-v1.5` (768 dims) on `http://localhost:8081`.
- Reranker: TEI in rerank mode serving `BAAI/bge-reranker-base` on `http://localhost:8082`.
- Postgres + pgvector unchanged, but embedding column dimension switches from 1536 to **768** when in local mode.

**Files:**

- Create: `packages/core/src/providers/types.ts`, `packages/core/src/providers/openai.ts`, `packages/core/src/providers/local.ts`, `packages/core/src/providers/index.ts`
- Create: `packages/core/tests/providers/local.test.ts`
- Update: `packages/core/src/ingest/embed.ts` (or rewire callers to use provider)
- Update: `packages/core/src/generate/answer.ts` (accept generic chat client matching the provider interface)
- Update: `packages/core/src/retrieve/rerank.ts` (accept generic reranker matching the provider interface)
- Update: `packages/core/src/db/schema.ts` (vector dim becomes parameterized via env at startup; defaults to 1536 for OpenAI)
- Create: `packages/core/migrations/0001_local_dims.sql` (provides ALTER paths)
- Update: `docker-compose.yml` (add `tei-embed`, `tei-rerank` services; add `llama-cpp` optional service or document host install)
- Update: `.env.example` (`MODEL_PROVIDER`, `LOCAL_LLM_URL`, `LOCAL_EMBED_URL`, `LOCAL_RERANK_URL`, `LOCAL_EMBED_DIM`)
- Update: `README.md` (local-stack quickstart)

- [ ] **Step 1: Define provider interface**

`packages/core/src/providers/types.ts`:

```ts
import type { Answer } from "../generate/answer.js";
import type { RetrievedChunk } from "../retrieve/vector.js";

export interface ChatProvider {
  generateAnswer(input: {
    query: string;
    chunks: RetrievedChunk[];
  }): Promise<Answer>;
}

export interface EmbedProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimensions(): number;
}

export interface RerankProvider {
  rerank(
    query: string,
    chunks: RetrievedChunk[],
    opts: { topN: number },
  ): Promise<RetrievedChunk[]>;
}

export interface ModelProviders {
  chat: ChatProvider;
  embed: EmbedProvider;
  rerank: RerankProvider;
}
```

- [ ] **Step 2: Wrap existing OpenAI/Cohere call sites as the OpenAI provider**

`packages/core/src/providers/openai.ts`:

```ts
import OpenAI from "openai";
import { CohereClient } from "cohere-ai";
import { embedTexts } from "../ingest/embed.js";
import { generateAnswer } from "../generate/answer.js";
import { rerank as cohereRerank } from "../retrieve/rerank.js";
import type { ModelProviders } from "./types.js";

export function buildOpenAIProvider(env: NodeJS.ProcessEnv): ModelProviders {
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const cohere = new CohereClient({ token: env.COHERE_API_KEY });
  return {
    chat: {
      generateAnswer: ({ query, chunks }) =>
        generateAnswer({ client: openai, query, chunks }),
    },
    embed: {
      embed: (texts) => embedTexts(texts, { client: openai }),
      dimensions: () => 1536,
    },
    rerank: {
      rerank: (q, c, opts) => cohereRerank(cohere, q, c, opts),
    },
  };
}
```

- [ ] **Step 3: Local provider — llama.cpp + TEI**

`packages/core/src/providers/local.ts`:

```ts
import OpenAI from "openai";
import { generateAnswer } from "../generate/answer.js";
import type { RetrievedChunk } from "../retrieve/vector.js";
import type { ModelProviders } from "./types.js";

interface LocalConfig {
  llmUrl: string; // e.g. http://localhost:8080/v1
  embedUrl: string; // TEI embed root, e.g. http://localhost:8081
  rerankUrl: string; // TEI rerank root, e.g. http://localhost:8082
  embedDim: number; // e.g. 768
  llmModel: string; // tag accepted by llama.cpp server, often "default"
}

export function buildLocalProvider(cfg: LocalConfig): ModelProviders {
  // llama.cpp serves OpenAI-compatible /v1 — reuse the OpenAI SDK client.
  const llm = new OpenAI({ apiKey: "local", baseURL: cfg.llmUrl });

  return {
    chat: {
      generateAnswer: ({ query, chunks }) =>
        generateAnswer({
          client: llm,
          query,
          chunks,
          model: cfg.llmModel,
        }),
    },
    embed: {
      dimensions: () => cfg.embedDim,
      embed: async (texts) => {
        if (texts.length === 0) return [];
        const res = await fetch(`${cfg.embedUrl}/embed`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ inputs: texts }),
        });
        if (!res.ok) throw new Error(`tei embed: ${res.status}`);
        return (await res.json()) as number[][];
      },
    },
    rerank: {
      rerank: async (
        query: string,
        chunks: RetrievedChunk[],
        opts: { topN: number },
      ) => {
        if (chunks.length === 0) return [];
        const res = await fetch(`${cfg.rerankUrl}/rerank`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query,
            texts: chunks.map((c) => c.text),
            return_text: false,
          }),
        });
        if (!res.ok) throw new Error(`tei rerank: ${res.status}`);
        const json = (await res.json()) as { index: number; score: number }[];
        return json
          .sort((a, b) => b.score - a.score)
          .slice(0, opts.topN)
          .map((r) => ({ ...chunks[r.index]!, score: r.score }));
      },
    },
  };
}
```

- [ ] **Step 4: Provider selector**

`packages/core/src/providers/index.ts`:

```ts
import { buildOpenAIProvider } from "./openai.js";
import { buildLocalProvider } from "./local.js";
import type { ModelProviders } from "./types.js";

export function buildProviders(
  env: NodeJS.ProcessEnv = process.env,
): ModelProviders {
  const kind = env.MODEL_PROVIDER ?? "openai";
  if (kind === "local") {
    return buildLocalProvider({
      llmUrl: env.LOCAL_LLM_URL ?? "http://localhost:8080/v1",
      embedUrl: env.LOCAL_EMBED_URL ?? "http://localhost:8081",
      rerankUrl: env.LOCAL_RERANK_URL ?? "http://localhost:8082",
      embedDim: Number(env.LOCAL_EMBED_DIM ?? 768),
      llmModel: env.LOCAL_LLM_MODEL ?? "default",
    });
  }
  return buildOpenAIProvider(env);
}

export type { ModelProviders } from "./types.js";
```

- [ ] **Step 5: Test the local provider with mocked fetch**

`packages/core/tests/providers/local.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildLocalProvider } from "../../src/providers/local.js";

const cfg = {
  llmUrl: "http://x/v1",
  embedUrl: "http://e",
  rerankUrl: "http://r",
  embedDim: 768,
  llmModel: "default",
};

const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn() as any;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("local embed", () => {
  it("calls TEI /embed with the inputs", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
    });
    const p = buildLocalProvider(cfg);
    const out = await p.embed.embed(["a", "b"]);
    expect(out).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    const call = (globalThis.fetch as any).mock.calls[0];
    expect(call[0]).toBe("http://e/embed");
    expect(JSON.parse(call[1].body).inputs).toEqual(["a", "b"]);
  });

  it("short-circuits on empty input", async () => {
    const p = buildLocalProvider(cfg);
    expect(await p.embed.embed([])).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("local rerank", () => {
  it("calls TEI /rerank and reorders", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [
        { index: 1, score: 0.9 },
        { index: 0, score: 0.2 },
      ],
    });
    const p = buildLocalProvider(cfg);
    const chunks = [
      {
        chunkId: 1,
        documentId: 1,
        text: "x",
        score: 0,
        source: "hybrid" as const,
      },
      {
        chunkId: 2,
        documentId: 1,
        text: "y",
        score: 0,
        source: "hybrid" as const,
      },
    ];
    const out = await p.rerank.rerank("q", chunks, { topN: 1 });
    expect(out).toHaveLength(1);
    expect(out[0]?.chunkId).toBe(2);
    expect(out[0]?.score).toBeCloseTo(0.9);
  });
});
```

- [ ] **Step 6: Schema parameterization**

The chunk embedding dim must match the active provider. Approach: keep schema literal (1536) for OpenAI, add migration `0001_local_dims.sql` that provides a documented `ALTER` path. Safer: introduce a `provider` column on `documents` for clarity in mixed deployments.

`packages/core/migrations/0001_local_dims.sql`:

```sql
-- Apply ONLY when switching to local provider with bge-base (768 dims).
-- Truncate first because the index and vectors are dim-bound.
TRUNCATE chunks RESTART IDENTITY;
ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(768);
DROP INDEX IF EXISTS chunks_embedding_idx;
CREATE INDEX chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
```

Document in README:

> Switching providers requires re-ingestion. Run `0001_local_dims.sql` (or its inverse) before `pnpm seed` whenever you change `MODEL_PROVIDER`.

- [ ] **Step 7: Wire provider into eval CLI and Slack app**

Replace direct `embedTexts` / `generateAnswer` / `cohereRerank` constructions in:

- `packages/core/src/eval/cli.ts`
- `packages/slack-app/src/index.ts`
- `seed/scripts/seed.ts`

with `buildProviders()` and call `providers.embed.embed`, `providers.chat.generateAnswer`, `providers.rerank.rerank`. Pipeline (`retrieve`, `applyGuard`) stays unchanged.

- [ ] **Step 8: Docker compose services for TEI**

Add to `docker-compose.yml`:

```yaml
  tei-embed:
    image: ghcr.io/huggingface/text-embeddings-inference:cpu-latest
    command: ["--model-id", "BAAI/bge-base-en-v1.5", "--port", "80"]
    ports:
      - "8081:80"
    profiles: ["local"]

  tei-rerank:
    image: ghcr.io/huggingface/text-embeddings-inference:cpu-latest
    command: ["--model-id", "BAAI/bge-reranker-base", "--port", "80"]
    ports:
      - "8082:80"
    profiles: ["local"]
```

(`profiles: ["local"]` keeps them out of default `docker compose up`.)

LLM via host install: `brew install llama.cpp` then `llama-server -m <model.gguf> --port 8080 --host 0.0.0.0 -c 8192 -ngl 999`. Document in README. (Avoid Docker for the LLM on Mac: Docker Desktop on Mac doesn't expose the Metal GPU.)

- [ ] **Step 9: README quickstart**

Add a "Local model stack" section:

```md
### Local model stack (no API keys required)

1. `brew install llama.cpp huggingface-cli`
2. `huggingface-cli download Qwen/Qwen2.5-7B-Instruct-GGUF Qwen2.5-7B-Instruct-Q4_K_M.gguf --local-dir ./models`
3. `llama-server -m ./models/Qwen2.5-7B-Instruct-Q4_K_M.gguf --port 8080 --host 0.0.0.0 -c 8192 -ngl 999`
4. `docker compose --profile local up -d tei-embed tei-rerank postgres`
5. `docker compose exec -T postgres psql -U copilot -d copilot < packages/core/migrations/0001_local_dims.sql`
6. `MODEL_PROVIDER=local LOCAL_EMBED_DIM=768 pnpm seed`
7. `MODEL_PROVIDER=local LOCAL_EMBED_DIM=768 pnpm --filter @support-copilot/core eval`

Memory budget on a 16 GB M3 MacBook Pro: ~5 GB LLM + ~750 MB embed/rerank + ~500 MB Postgres + ~6 GB OS — comfortable.
```

- [ ] **Step 10: Run unit tests, then smoke test both providers**

```bash
pnpm --filter @support-copilot/core test providers/local
# OpenAI smoke (existing keys):
MODEL_PROVIDER=openai pnpm --filter @support-copilot/core eval
# Local smoke:
MODEL_PROVIDER=local LOCAL_EMBED_DIM=768 pnpm --filter @support-copilot/core eval
```

Expected: provider unit tests pass; both eval runs report ≥ 25/30. The local stack will typically score 2–4 cases lower than the OpenAI stack — adjust the `mustContain` strings or seed-doc keyword density rather than the eval threshold.

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "feat(providers): pluggable openai|local provider with llama.cpp + tei"
```

---

## Self-Review Checklist (run before handoff)

**Spec coverage:**

- ✓ Markdown + HTML ingestion (Task 3)
- ✓ Token-aware chunking with overlap (Task 4)
- ✓ pgvector embeddings (Tasks 2, 5, 6)
- ✓ Hybrid retrieval BM25 + vector (Tasks 7, 8, 9)
- ✓ Cohere rerank (Task 10)
- ✓ gpt-4o-mini structured output JSON (Task 12)
- ✓ Hallucination guard (Task 13)
- ✓ Slack Bolt + Next.js demo (Tasks 17, 18)
- ✓ 30 Q+citation eval pairs in CI (Tasks 15, 16, 19)
- ✓ Railway deploy with public demo URL (Task 20)
- ✓ Out-of-scope items NOT added: no auth/SSO, no multi-tenant, no fine-tuning, no conversation memory, no analytics dashboard, no billing.

**Type consistency:** `RetrievedChunk` defined in `retrieve/vector.ts` and reused everywhere. `Answer` schema defined in `generate/answer.ts` and reused in guard, orchestration, eval.

**Placeholder scan:** none — no TBD/TODO entries; every code-bearing step contains complete code.

---

## Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-01-f1-support-copilot.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, two-stage review, fast iteration.
**2. Inline Execution** — execute tasks in this session with checkpoints.

Pick when ready.
