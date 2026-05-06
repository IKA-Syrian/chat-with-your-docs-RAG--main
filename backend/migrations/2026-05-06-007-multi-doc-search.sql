-- 2026-05-06-007-multi-doc-search.sql
-- Phase 3 #17: multi-document chat. Adds an overload of
-- hybrid_match_document_sections that accepts an array of doc IDs (max 10).
-- The single-doc function from migration 003 is kept for back-compat.
--
-- Postgres allows function overloading by argument signature, so the single
-- and array variants coexist.

CREATE OR REPLACE FUNCTION hybrid_match_document_sections(
    query_text       TEXT,
    query_embedding  VECTOR(384),
    target_doc_ids   UUID[],
    top_k            INT  DEFAULT 12,
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
    WHERE (target_doc_ids IS NULL
           OR cardinality(target_doc_ids) = 0
           OR s.document_id = ANY(target_doc_ids))
      AND s.content_tsv @@ q.tsq
    ORDER BY ts_rank_cd(s.content_tsv, q.tsq) DESC
    LIMIT top_k * 4
  ),
  vec AS (
    SELECT s.id,
           ROW_NUMBER() OVER (ORDER BY s.embedding <=> query_embedding) AS r
    FROM document_sections s
    WHERE (target_doc_ids IS NULL
           OR cardinality(target_doc_ids) = 0
           OR s.document_id = ANY(target_doc_ids))
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

ALTER FUNCTION hybrid_match_document_sections(TEXT, VECTOR(384), UUID[], INT, INT)
    SECURITY INVOKER;

-- Track multi-doc chat sessions on the conversations row.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS document_ids UUID[];
