-- 2026-05-06-012-public-decks.sql
-- Phase 4 #23 — public deck library: publish flag + tags + upvotes + fork.
-- Additive only.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS published             BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS published_at          TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS published_title       TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS published_description TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags                  TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS forked_from           UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS upvotes_count         INT    NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_docs_published
    ON documents (published, published_at DESC) WHERE published = TRUE;

CREATE INDEX IF NOT EXISTS idx_docs_tags_gin
    ON documents USING GIN (tags) WHERE published = TRUE;

CREATE INDEX IF NOT EXISTS idx_docs_published_upvotes
    ON documents (upvotes_count DESC, published_at DESC) WHERE published = TRUE;

-- Allow ANYONE (incl. anonymous browsers) to read published docs.
DROP POLICY IF EXISTS "doc_select_public" ON documents;
CREATE POLICY "doc_select_public" ON documents FOR SELECT
    USING (published = TRUE);

DROP POLICY IF EXISTS "ds_sections_select_public" ON document_sections;
CREATE POLICY "ds_sections_select_public" ON document_sections FOR SELECT
    USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.published = TRUE));

DROP POLICY IF EXISTS "fc_select_public" ON flashcards;
CREATE POLICY "fc_select_public" ON flashcards FOR SELECT
    USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.published = TRUE));

-- Upvotes
CREATE TABLE IF NOT EXISTS deck_upvotes (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, document_id)
);

ALTER TABLE deck_upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upv_select_authed" ON deck_upvotes;
CREATE POLICY "upv_select_authed" ON deck_upvotes FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "upv_insert_self" ON deck_upvotes;
CREATE POLICY "upv_insert_self" ON deck_upvotes FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.published = TRUE)
);

DROP POLICY IF EXISTS "upv_delete_self" ON deck_upvotes;
CREATE POLICY "upv_delete_self" ON deck_upvotes FOR DELETE USING (user_id = auth.uid());

-- Maintain documents.upvotes_count via trigger so /explore?sort=upvotes is a btree scan.
CREATE OR REPLACE FUNCTION bump_upvote_count() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp        -- prevent search-path hijack on temp tables
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE documents SET upvotes_count = upvotes_count + 1 WHERE id = NEW.document_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE documents SET upvotes_count = GREATEST(upvotes_count - 1, 0) WHERE id = OLD.document_id;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_upvote_count ON deck_upvotes;
CREATE TRIGGER trg_upvote_count
AFTER INSERT OR DELETE ON deck_upvotes
FOR EACH ROW EXECUTE FUNCTION bump_upvote_count();

-- Fork RPC: copies a published doc + its sections + flashcards into a new
-- doc owned by `target_owner`. Atomic.
-- flashcard_reviews and wrong_answers are NOT copied (those are personal).
--
-- SECURITY: target_owner is FORCED to auth.uid() and target_id MUST be
-- previously unused. If the documents-row insert is suppressed by an
-- ON CONFLICT collision OR target_owner != auth.uid(), the function aborts
-- with no side effects on the dependent tables — preventing an authenticated
-- attacker from injecting sections/flashcards into a victim's document by
-- supplying that document's id as target_id.
CREATE OR REPLACE FUNCTION fork_document(source_id UUID, target_owner UUID, target_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    src RECORD;
    inserted_id UUID;
BEGIN
    -- Refuse forks made on behalf of someone else.
    IF target_owner IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'target_owner must equal auth.uid()';
    END IF;

    SELECT id, name, file_type, file_extension, processed
    INTO src
    FROM documents
    WHERE id = source_id AND published = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'source document % is not published', source_id;
    END IF;

    -- Create fork. NOT idempotent on target_id collision — we require a fresh id.
    -- A collision means either (a) caller passed an existing id (potential attack)
    -- or (b) UUID birthday collision (negligible). Either way, abort.
    INSERT INTO documents (
        id, name, created_by, file_type, file_extension,
        status, processed, forked_from, published
    )
    VALUES (
        target_id, src.name, target_owner, src.file_type, src.file_extension,
        'forked', src.processed, source_id, FALSE
    )
    RETURNING id INTO inserted_id;

    IF inserted_id IS NULL THEN
        -- Defensive — INSERT without ON CONFLICT should always RETURNING-or-error.
        RAISE EXCEPTION 'failed to insert fork document';
    END IF;

    -- Copy sections (preserve embeddings — same model, same vector space).
    -- parent_chunk_id is dropped on the fork; downstream regen will recompute.
    INSERT INTO document_sections (
        document_id, content, embedding, chunk_level, chunk_index, page_number
    )
    SELECT
        inserted_id, content, embedding, chunk_level, chunk_index, page_number
    FROM document_sections
    WHERE document_id = source_id;

    -- Copy flashcards (basic + cloze + short_answer all share the table).
    INSERT INTO flashcards (
        document_id, front, back, card_index, fingerprint,
        card_type, cloze_text, expected_answer
    )
    SELECT
        inserted_id, front, back, card_index, fingerprint,
        card_type, cloze_text, expected_answer
    FROM flashcards
    WHERE document_id = source_id;

    RETURN inserted_id;
END;
$$;

REVOKE ALL ON FUNCTION fork_document(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fork_document(UUID, UUID, UUID) TO authenticated;
