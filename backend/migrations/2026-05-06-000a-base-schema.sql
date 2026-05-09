-- 2026-05-06-000a-base-schema.sql
-- Base schema (documents + sections + conversations + messages) for fresh
-- environments. Mirrors backend/schema.sql but uses gen_random_uuid() instead
-- of uuid_generate_v4() (uuid-ossp not always installed) and skips the
-- storage.objects view (Supabase Storage isn't present on bare Postgres,
-- and the view isn't used by application code).
--
-- All later migrations (001..013) ALTER TABLE … ADD COLUMN IF NOT EXISTS
-- against these tables, so installing this once unblocks the entire chain.
-- Idempotent: every CREATE uses IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector for VECTOR(384) embeddings

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_object_id  TEXT,
    processed          BOOLEAN DEFAULT FALSE,
    processed_at       TIMESTAMPTZ,
    status             TEXT DEFAULT 'pending',
    file_type          TEXT,
    file_extension     TEXT
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
CREATE POLICY "Users can insert their own documents"
    ON documents FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
CREATE POLICY "Users can update their own documents"
    ON documents FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can select their own documents" ON documents;
CREATE POLICY "Users can select their own documents"
    ON documents FOR SELECT USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;
CREATE POLICY "Users can delete their own documents"
    ON documents FOR DELETE USING (auth.uid() = created_by);

-- ---------------------------------------------------------------------------
-- document_sections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_sections (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content      TEXT NOT NULL,
    embedding    VECTOR(384),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert document sections for their documents" ON document_sections;
CREATE POLICY "Users can insert document sections for their documents"
    ON document_sections FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM documents d
                WHERE d.id = document_sections.document_id
                  AND d.created_by = auth.uid())
    );

DROP POLICY IF EXISTS "Users can select document sections for their documents" ON document_sections;
CREATE POLICY "Users can select document sections for their documents"
    ON document_sections FOR SELECT USING (
        EXISTS (SELECT 1 FROM documents d
                WHERE d.id = document_sections.document_id
                  AND d.created_by = auth.uid())
    );

DROP POLICY IF EXISTS "Users can delete document sections for their documents" ON document_sections;
CREATE POLICY "Users can delete document sections for their documents"
    ON document_sections FOR DELETE USING (
        EXISTS (SELECT 1 FROM documents d
                WHERE d.id = document_sections.document_id
                  AND d.created_by = auth.uid())
    );

CREATE INDEX IF NOT EXISTS idx_document_sections_content_fts
    ON document_sections USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_document_sections_embedding
    ON document_sections USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id      UUID REFERENCES documents(id) ON DELETE SET NULL,
    title            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
CREATE POLICY "Users can insert their own conversations"
    ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
CREATE POLICY "Users can update their own conversations"
    ON conversations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select their own conversations" ON conversations;
CREATE POLICY "Users can select their own conversations"
    ON conversations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;
CREATE POLICY "Users can delete their own conversations"
    ON conversations FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content          TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
CREATE POLICY "Users can insert their own messages"
    ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select their own messages" ON messages;
CREATE POLICY "Users can select their own messages"
    ON messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users cannot update messages" ON messages;
CREATE POLICY "Users cannot update messages"
    ON messages FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages"
    ON messages FOR DELETE USING (auth.uid() = user_id);
