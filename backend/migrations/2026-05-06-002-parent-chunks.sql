-- 2026-05-06-002-parent-chunks.sql
-- Hierarchical (parent / child) chunking on document_sections.
-- Additive: existing rows become "level 0" with parent_chunk_id = NULL and
-- chunk_level = 0; the retrieval RPC uses COALESCE(parent_chunk_id, id) so
-- legacy data continues to work until the document is reprocessed.

-- 1) Self-referencing parent column
ALTER TABLE document_sections
    ADD COLUMN IF NOT EXISTS parent_chunk_id UUID
        REFERENCES document_sections(id) ON DELETE CASCADE;

-- 2) Level: 0 = parent (large, no embedding required), 1 = child (small, embedded for matching)
ALTER TABLE document_sections
    ADD COLUMN IF NOT EXISTS chunk_level SMALLINT NOT NULL DEFAULT 0;

-- 3) Stable index inside the parent (or in the doc, for legacy rows)
ALTER TABLE document_sections
    ADD COLUMN IF NOT EXISTS chunk_index INT;

-- 4) Page number for citations (Feature #1)
ALTER TABLE document_sections
    ADD COLUMN IF NOT EXISTS page_number INT;

CREATE INDEX IF NOT EXISTS idx_doc_sections_parent
    ON document_sections (parent_chunk_id);

CREATE INDEX IF NOT EXISTS idx_doc_sections_doc_level
    ON document_sections (document_id, chunk_level);
