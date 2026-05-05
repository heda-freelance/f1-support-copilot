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
pnpm eval
```

## Local model stack (no API keys required)

Runs the entire pipeline against open-source GGUF models via three native `llama-server` processes on Apple Silicon. No Docker for inference (TEI's `cpu-latest` image is amd64-only and runs ~5x slower under Rosetta on arm64). Requires ~12 GB free RAM.

1. Install host tools:

   ```bash
   brew install llama.cpp huggingface-cli
   ```

   `huggingface-cli` is deprecated; the `hf` binary is installed alongside it.

2. Download GGUF models. Single-file quants from the bartowski mirrors keep things simple:

   ```bash
   # LLM — 7B (recommended on 16 GB+):
   hf download bartowski/Qwen2.5-7B-Instruct-GGUF \
     Qwen2.5-7B-Instruct-Q4_K_M.gguf --local-dir ./models

   # Embeddings — bge-base-en-v1.5 (768 dims):
   hf download CompendiumLabs/bge-base-en-v1.5-gguf \
     bge-base-en-v1.5-q8_0.gguf --local-dir ./models

   # Reranker — bge-reranker-v2-m3:
   hf download gpustack/bge-reranker-v2-m3-GGUF \
     bge-reranker-v2-m3-Q8_0.gguf --local-dir ./models
   ```

   The official `Qwen/Qwen2.5-7B-Instruct-GGUF` repo ships sharded quants (`...-q4_k_m-00001-of-00002.gguf` etc); the bartowski mirror keeps a single-file Q4_K_M which is simpler.

3. Start three `llama-server` processes (each in its own terminal — uses Metal on Apple Silicon):

   ```bash
   # LLM on :8080 (OpenAI-compatible /v1/chat/completions)
   llama-server -m ./models/Qwen2.5-7B-Instruct-Q4_K_M.gguf \
     --port 8080 --host 0.0.0.0 -c 8192 -ngl 999

   # Embeddings on :8081 (OpenAI-compatible /v1/embeddings)
   llama-server -m ./models/bge-base-en-v1.5-q8_0.gguf \
     --embedding --port 8081 --host 0.0.0.0 -ngl 999

   # Reranker on :8082 (/v1/rerank)
   llama-server -m ./models/bge-reranker-v2-m3-Q8_0.gguf \
     --reranking --port 8082 --host 0.0.0.0 -ngl 999
   ```

4. Start Postgres and apply migrations (switch `chunks.embedding` from 1536 → 768):

   ```bash
   docker compose up -d postgres
   docker compose exec -T postgres psql -U copilot -d copilot \
     < packages/core/migrations/0000_init.sql
   docker compose exec -T postgres psql -U copilot -d copilot \
     < packages/core/migrations/0001_local_dims.sql
   ```

5. Seed and evaluate:

   ```bash
   export MODEL_PROVIDER=local
   export LOCAL_EMBED_DIM=768
   export DATABASE_URL=postgres://copilot:copilot@localhost:5432/copilot
   pnpm seed
   pnpm eval
   ```

Switching providers requires re-ingestion. Run `0001_local_dims.sql` (or the inverse `0001_openai_dims.sql`) and re-`pnpm seed` whenever you change `MODEL_PROVIDER`.

Memory budget on a 16 GB M3 MacBook Pro: ~5 GB LLM + ~600 MB embed + ~600 MB rerank + ~500 MB Postgres + ~6 GB OS — comfortable.
