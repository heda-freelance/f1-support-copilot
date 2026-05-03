-- Apply ONLY when switching to local provider with bge-base (768 dims).
-- Truncate first because the index and vectors are dim-bound.
TRUNCATE chunks RESTART IDENTITY;
ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(768);
DROP INDEX IF EXISTS chunks_embedding_idx;
CREATE INDEX chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);
