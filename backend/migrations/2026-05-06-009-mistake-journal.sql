-- 2026-05-06-009-mistake-journal.sql
-- Phase 3 #9: unified mistake journal across quiz / flashcard / short-answer.

CREATE TABLE IF NOT EXISTS wrong_answers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id     UUID REFERENCES documents(id) ON DELETE CASCADE,
    source_kind     TEXT NOT NULL CHECK (source_kind IN ('quiz', 'flashcard', 'short_answer')),
    source_id       UUID,                          -- quiz-question id / flashcard id (nullable)
    question        TEXT NOT NULL,                 -- denormalized so deletes don't clobber the journal
    expected_answer TEXT,
    user_answer     TEXT,
    source_chunk_id UUID REFERENCES document_sections(id) ON DELETE SET NULL,
    ai_explanation  TEXT,                          -- generated lazily on first view
    details         JSONB DEFAULT '{}'::jsonb,     -- type-specific payload
    resolved        BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wrong_answers_user_doc
    ON wrong_answers (user_id, document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wrong_answers_unresolved
    ON wrong_answers (user_id, resolved)
    WHERE resolved = FALSE;

ALTER TABLE wrong_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_select_own" ON wrong_answers;
CREATE POLICY "wa_select_own" ON wrong_answers FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wa_insert_own" ON wrong_answers;
CREATE POLICY "wa_insert_own" ON wrong_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wa_update_own" ON wrong_answers;
CREATE POLICY "wa_update_own" ON wrong_answers FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wa_delete_own" ON wrong_answers;
CREATE POLICY "wa_delete_own" ON wrong_answers FOR DELETE USING (auth.uid() = user_id);
