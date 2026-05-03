-- Inverse of 0001_local_dims.sql: revert to OpenAI text-embedding-3-small dims.
-- Truncate first because the index and vectors are dim-bound.
TRUNCATE chunks RESTART IDENTITY;
ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(1536);
DROP INDEX IF EXISTS chunks_embedding_idx;
CREATE INDEX chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);
