-- 2026-05-06-013-message-sources.sql
-- Persist per-message metadata (citations, token usage, model used) so a
-- conversation reloaded after a refresh still shows sources, costs, and
-- which model produced each reply. Additive only.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sources  JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS usage    JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS model    TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS provider TEXT;
