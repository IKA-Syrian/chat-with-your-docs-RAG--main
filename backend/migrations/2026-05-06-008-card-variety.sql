-- 2026-05-06-008-card-variety.sql
-- Phase 3 #7: cloze deletion + short-answer flashcards.
-- Reuses the existing flashcards table (from migration 004) with a discriminator.

ALTER TABLE flashcards
    ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'basic';   -- 'basic' | 'cloze' | 'short_answer'

ALTER TABLE flashcards
    ADD COLUMN IF NOT EXISTS cloze_text TEXT;       -- raw "{{c1::TERM}} is the …" string

ALTER TABLE flashcards
    ADD COLUMN IF NOT EXISTS expected_answer TEXT;  -- short-answer rubric / model answer

CREATE INDEX IF NOT EXISTS idx_flashcards_card_type
    ON flashcards (document_id, card_type);

-- Per-attempt log for short-answer grading. Feeds the mistake journal too.
CREATE TABLE IF NOT EXISTS short_answer_attempts (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flashcard_id      UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    user_answer       TEXT NOT NULL,
    score             REAL NOT NULL,                 -- 0..1 from LLM judge
    rating_suggested  SMALLINT,                      -- 1..4 mapped from score (for FSRS)
    feedback          TEXT,
    matched_keywords  TEXT[],
    missing_keywords  TEXT[],
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_attempts_user_card
    ON short_answer_attempts (user_id, flashcard_id, created_at DESC);

ALTER TABLE short_answer_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sa_select_own" ON short_answer_attempts;
CREATE POLICY "sa_select_own" ON short_answer_attempts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sa_insert_own" ON short_answer_attempts;
CREATE POLICY "sa_insert_own" ON short_answer_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sa_delete_own" ON short_answer_attempts;
CREATE POLICY "sa_delete_own" ON short_answer_attempts FOR DELETE USING (auth.uid() = user_id);
