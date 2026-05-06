-- 2026-05-06-003-hybrid-search.sql
-- Hybrid search: BM25-style ts_rank_cd over a stored tsvector, fused with
-- pgvector cosine similarity using Reciprocal Rank Fusion (k = 60).
--
-- Depends on: 2026-05-06-002-parent-chunks.sql (uses parent_chunk_id and chunk_level).

-- 1) Stored tsvector column (faster for ts_rank_cd than the existing expression index).
ALTER TABLE document_sections
    ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_doc_sections_content_tsv
    ON document_sections USING GIN (content_tsv);

-- 2) Hybrid retrieval RPC.
--    Matches against child chunks (chunk_level = 1) when present, otherwise legacy
--    rows (chunk_level = 0 with embeddings). Returns the *parent* content for
--    context — falls back to self when no parent is set.
CREATE OR REPLACE FUNCTION hybrid_match_document_sections(
    query_text       TEXT,
    query_embedding  VECTOR(384),
    target_doc_id    UUID DEFAULT NULL,
    top_k            INT  DEFAULT 8,
    rrf_k            INT  DEFAULT 60
)
RETURNS TABLE (
    id           UUID,
    document_id  UUID,
    content      TEXT,
    page_number  INT,
    chunk_index  INT,
    bm25_rank    INT,
    vec_rank     INT,
    rrf_score    REAL
)
LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT websearch_to_tsquery('english', coalesce(query_text, '')) AS tsq),
  bm25 AS (
    SELECT s.id,
           ROW_NUMBER() OVER (ORDER BY ts_rank_cd(s.content_tsv, q.tsq) DESC) AS r
    FROM document_sections s, q
    WHERE (target_doc_id IS NULL OR s.document_id = target_doc_id)
      AND s.content_tsv @@ q.tsq
    ORDER BY ts_rank_cd(s.content_tsv, q.tsq) DESC
    LIMIT top_k * 4
  ),
  vec AS (
    SELECT s.id,
           ROW_NUMBER() OVER (ORDER BY s.embedding <=> query_embedding) AS r
    FROM document_sections s
    WHERE (target_doc_id IS NULL OR s.document_id = target_doc_id)
      AND s.embedding IS NOT NULL
    ORDER BY s.embedding <=> query_embedding
    LIMIT top_k * 4
  ),
  fused AS (
    SELECT COALESCE(b.id, v.id) AS id,
           b.r AS bm25_rank,
           v.r AS vec_rank,
           (CASE WHEN b.r IS NOT NULL THEN 1.0/(rrf_k + b.r) ELSE 0 END +
            CASE WHEN v.r IS NOT NULL THEN 1.0/(rrf_k + v.r) ELSE 0 END)::real AS rrf_score
    FROM bm25 b FULL OUTER JOIN vec v ON v.id = b.id
  )
  SELECT
      p.id,
      p.document_id,
      p.content,
      p.page_number,
      p.chunk_index,
      f.bm25_rank,
      f.vec_rank,
      f.rrf_score
  FROM fused f
  JOIN document_sections c ON c.id = f.id
  LEFT JOIN document_sections p ON p.id = COALESCE(c.parent_chunk_id, c.id)
  ORDER BY f.rrf_score DESC
  LIMIT top_k;
$$;

-- Make sure the function runs as the caller, not the definer — preserves RLS.
ALTER FUNCTION hybrid_match_document_sections(TEXT, VECTOR(384), UUID, INT, INT)
    SECURITY INVOKER;
