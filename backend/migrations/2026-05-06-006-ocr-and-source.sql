-- 2026-05-06-006-ocr-and-source.sql
-- Phase 3 #14 + #15: OCR metadata on `documents`, content-hash OCR cache,
-- and source provenance columns for URL/YouTube ingestion.
-- Additive only.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_used BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_provider TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_model TEXT;

-- 'upload' (default for legacy rows) | 'url' | 'youtube'
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_url  TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_source_url
    ON documents (created_by, source_url)
    WHERE source_url IS NOT NULL;

-- Content-hash cache so re-uploading the same scan is free.
CREATE TABLE IF NOT EXISTS ocr_cache (
    file_sha256 TEXT PRIMARY KEY,
    text        TEXT NOT NULL,
    provider    TEXT,
    model       TEXT,
    char_count  INT GENERATED ALWAYS AS (length(text)) STORED,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The cache is shared across users (same scan = same OCR), so we don't add RLS.
-- Reads/writes happen via supabaseAdmin() in process.js.
ALTER TABLE ocr_cache DISABLE ROW LEVEL SECURITY;
