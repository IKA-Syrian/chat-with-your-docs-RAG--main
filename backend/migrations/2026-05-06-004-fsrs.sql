-- 2026-05-06-004-fsrs.sql
-- Spaced-repetition: materialize flashcards into rows and track per-user FSRS state.
-- Additive: documents.flashcards JSON stays untouched for backward compat.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS flashcards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    front           TEXT NOT NULL,
    back            TEXT NOT NULL,
    source_chunk_id UUID REFERENCES document_sections(id) ON DELETE SET NULL,
    card_index      INT,                              -- position in the original JSON array
    fingerprint     TEXT,                             -- sha256(front||back) for idempotent backfill
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_flashcards_document ON flashcards(document_id);

ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fc_select_own" ON flashcards;
CREATE POLICY "fc_select_own" ON flashcards FOR SELECT USING (
    EXISTS (SELECT 1 FROM documents d WHERE d.id = flashcards.document_id AND d.created_by = auth.uid())
);

DROP POLICY IF EXISTS "fc_insert_own" ON flashcards;
CREATE POLICY "fc_insert_own" ON flashcards FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM documents d WHERE d.id = flashcards.document_id AND d.created_by = auth.uid())
);

DROP POLICY IF EXISTS "fc_delete_own" ON flashcards;
CREATE POLICY "fc_delete_own" ON flashcards FOR DELETE USING (
    EXISTS (SELECT 1 FROM documents d WHERE d.id = flashcards.document_id AND d.created_by = auth.uid())
);

-- Per-user-per-card FSRS state. Owns scheduling; flashcards row stays content-only.
CREATE TABLE IF NOT EXISTS flashcard_reviews (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flashcard_id  UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- FSRS state
    due_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stability     REAL        NOT NULL DEFAULT 0,
    difficulty    REAL        NOT NULL DEFAULT 0,
    reps          INT         NOT NULL DEFAULT 0,
    lapses        INT         NOT NULL DEFAULT 0,
    state         SMALLINT    NOT NULL DEFAULT 0,    -- 0=new 1=learning 2=review 3=relearning
    last_review   TIMESTAMPTZ,
    last_rating   SMALLINT,                          -- 1..4 (Again, Hard, Good, Easy)
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (flashcard_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fc_reviews_due
    ON flashcard_reviews (user_id, due_at)
    INCLUDE (flashcard_id, state);

CREATE INDEX IF NOT EXISTS idx_fc_reviews_card
    ON flashcard_reviews (flashcard_id);

ALTER TABLE flashcard_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fr_select_own" ON flashcard_reviews;
CREATE POLICY "fr_select_own" ON flashcard_reviews FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "fr_insert_own" ON flashcard_reviews;
CREATE POLICY "fr_insert_own" ON flashcard_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "fr_update_own" ON flashcard_reviews;
CREATE POLICY "fr_update_own" ON flashcard_reviews FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "fr_delete_own" ON flashcard_reviews;
CREATE POLICY "fr_delete_own" ON flashcard_reviews FOR DELETE USING (auth.uid() = user_id);
