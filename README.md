# Support Copilot

RAG-powered support bot for B2B SaaS. Answers tier-1 tickets from your help docs with citations; escalates when unsure.

See `docs/architecture.md` for design.

## Quickstart (OpenAI provider)

```bash
docker compose up -d postgres
docker compose exec -T postgres psql -U copilot -d copilot < packages/core/migrations/0000_init.sql
export OPENAI_API_KEY=sk-...
export COHERE_API_KEY=...
export DATABASE_URL=postgres://copilot:copilot@localhost:5432/copilot
pnpm install
pnpm seed
pnpm --filter @support-copilot/core eval
```

## Local model stack (no API keys required)

Run the entire pipeline against open-source models on a 2024 MacBook Pro. Requires ~12 GB free RAM.

1. Install host tools:

   ```bash
   brew install llama.cpp huggingface-cli
   ```

2. Download an LLM in GGUF format. Pick by your RAM budget:

   ```bash
   # 7B (recommended on 16 GB+):
   huggingface-cli download Qwen/Qwen2.5-7B-Instruct-GGUF \
     Qwen2.5-7B-Instruct-Q4_K_M.gguf --local-dir ./models

   # 3B (lighter, faster):
   huggingface-cli download bartowski/Llama-3.2-3B-Instruct-GGUF \
     Llama-3.2-3B-Instruct-Q4_K_M.gguf --local-dir ./models
   ```

3. Start the LLM server (uses Metal GPU on Apple Silicon):

   ```bash
   llama-server -m ./models/Qwen2.5-7B-Instruct-Q4_K_M.gguf \
     --port 8080 --host 0.0.0.0 -c 8192 -ngl 999
   ```

4. Start the TEI embedder + reranker + Postgres:

   ```bash
   docker compose --profile local up -d tei-embed tei-rerank postgres
   ```

5. Apply the local-dimensions migration (switches the `chunks.embedding` column from 1536 → 768):

   ```bash
   docker compose exec -T postgres psql -U copilot -d copilot \
     < packages/core/migrations/0000_init.sql
   docker compose exec -T postgres psql -U copilot -d copilot \
     < packages/core/migrations/0001_local_dims.sql
   ```

6. Seed and evaluate:

   ```bash
   export MODEL_PROVIDER=local
   export LOCAL_EMBED_DIM=768
   export DATABASE_URL=postgres://copilot:copilot@localhost:5432/copilot
   pnpm seed
   pnpm --filter @support-copilot/core eval
   ```

Switching providers requires re-ingestion. Run `0001_local_dims.sql` (or the inverse `0001_openai_dims.sql`) and re-`pnpm seed` whenever you change `MODEL_PROVIDER`.

Memory budget on a 16 GB M3 MacBook Pro: ~5 GB LLM + ~750 MB embed/rerank + ~500 MB Postgres + ~6 GB OS — comfortable.
