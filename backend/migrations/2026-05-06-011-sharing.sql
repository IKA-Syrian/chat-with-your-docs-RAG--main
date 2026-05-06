-- 2026-05-06-011-sharing.sql
-- Phase 4 #22 — per-document sharing via direct grants and tokenized invites.
--
-- Design notes:
--  * `can_read_document` and `can_write_document` are the SINGLE source of
--    truth for visibility. New SELECT policies on dependent tables call into
--    them so a future bug only needs to be fixed in one place.
--  * Existing per-row policies (created_by = auth.uid()) are kept; Postgres
--    OR-combines multiple permissive policies on the same table, so this is
--    purely additive — pre-migration access is unchanged.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION can_read_document(doc_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.id = doc_id
      AND (
        (uid IS NOT NULL AND d.created_by = uid)
        OR (uid IS NOT NULL AND EXISTS (
            SELECT 1 FROM document_shares s
            WHERE s.document_id = doc_id
              AND s.shared_with_user_id = uid
        ))
        OR COALESCE(d.published, FALSE) = TRUE
      )
  );
$$;

CREATE OR REPLACE FUNCTION can_write_document(doc_id UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.id = doc_id
      AND uid IS NOT NULL
      AND (
        d.created_by = uid
        OR EXISTS (
            SELECT 1 FROM document_shares s
            WHERE s.document_id = doc_id
              AND s.shared_with_user_id = uid
              AND s.permission = 'edit'
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- document_shares
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS document_shares (
    document_id          UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    shared_with_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission           TEXT NOT NULL CHECK (permission IN ('read','study','edit')),
    granted_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (document_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_shares_user ON document_shares (shared_with_user_id);

ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ds_select_self_or_owner" ON document_shares;
CREATE POLICY "ds_select_self_or_owner" ON document_shares FOR SELECT USING (
    shared_with_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.created_by = auth.uid())
);

DROP POLICY IF EXISTS "ds_insert_owner" ON document_shares;
CREATE POLICY "ds_insert_owner" ON document_shares FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.created_by = auth.uid())
);

DROP POLICY IF EXISTS "ds_delete_owner_or_self" ON document_shares;
CREATE POLICY "ds_delete_owner_or_self" ON document_shares FOR DELETE USING (
    shared_with_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.created_by = auth.uid())
);

-- ---------------------------------------------------------------------------
-- document_invites
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS document_invites (
    token        TEXT PRIMARY KEY,                          -- 32-byte url-safe random string
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    permission   TEXT NOT NULL CHECK (permission IN ('read','study','edit')),
    created_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_hint   TEXT,
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    redeemed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    redeemed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_doc ON document_invites (document_id);

ALTER TABLE document_invites ENABLE ROW LEVEL SECURITY;

-- Owners can list their own invites; redemption goes through admin client.
DROP POLICY IF EXISTS "di_select_owner" ON document_invites;
CREATE POLICY "di_select_owner" ON document_invites FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "di_insert_owner" ON document_invites;
CREATE POLICY "di_insert_owner" ON document_invites FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.created_by = auth.uid())
);

DROP POLICY IF EXISTS "di_delete_owner" ON document_invites;
CREATE POLICY "di_delete_owner" ON document_invites FOR DELETE USING (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Expand SELECT policies on existing tables so shared users can read content.
-- These are ADDITIVE — Postgres OR-combines permissive policies on the same
-- command (SELECT). Existing owner-only policies remain in place.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "doc_select_shared_or_published" ON documents;
CREATE POLICY "doc_select_shared_or_published" ON documents FOR SELECT
    USING (can_read_document(id, auth.uid()));

DROP POLICY IF EXISTS "ds_sections_select_shared" ON document_sections;
CREATE POLICY "ds_sections_select_shared" ON document_sections FOR SELECT
    USING (can_read_document(document_id, auth.uid()));

DROP POLICY IF EXISTS "fc_select_shared" ON flashcards;
CREATE POLICY "fc_select_shared" ON flashcards FOR SELECT
    USING (can_read_document(document_id, auth.uid()));

-- knowledge_graphs: expand the existing owner-only SELECT to cover shared users too.
DROP POLICY IF EXISTS "kg_select_shared" ON knowledge_graphs;
CREATE POLICY "kg_select_shared" ON knowledge_graphs FOR SELECT
    USING (can_read_document(document_id, auth.uid()));

-- flashcard_reviews and wrong_answers stay strictly per-user — review state and
-- mistake history are PRIVATE; sharing the deck doesn't share the journal.
