-- 2026-05-06-001-security-events.sql
-- Logs prompt-injection patterns detected in retrieved RAG chunks.
-- Additive: creates a new table; touches no existing data.

-- gen_random_uuid() is built into Postgres 13+ core. On older Postgres it
-- lives in pgcrypto; enabling the extension is a no-op when already present.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS security_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id   UUID REFERENCES documents(id) ON DELETE CASCADE,
    section_id    UUID,
    flag_type     TEXT NOT NULL,         -- 'literal' | 'regex' | 'closing_tag'
    pattern       TEXT,                  -- the matched pattern or regex source
    snippet       TEXT,                  -- sample of the offending content (truncated)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user
    ON security_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_document
    ON security_events (document_id, created_at DESC);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own security events" ON security_events;
CREATE POLICY "Users can view their own security events"
    ON security_events FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own security events" ON security_events;
CREATE POLICY "Users can insert their own security events"
    ON security_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);
