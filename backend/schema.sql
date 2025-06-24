-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_object_id TEXT,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending',
    file_type TEXT,
    file_extension TEXT
);
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- Add policies for secure access
DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
CREATE POLICY "Users can insert their own documents" ON documents FOR
INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
CREATE POLICY "Users can update their own documents" ON documents FOR
UPDATE USING (auth.uid() = created_by);
DROP POLICY IF EXISTS "Users can select their own documents" ON documents;
CREATE POLICY "Users can select their own documents" ON documents FOR
SELECT USING (auth.uid() = created_by);
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;
CREATE POLICY "Users can delete their own documents" ON documents FOR DELETE USING (auth.uid() = created_by);
-- Create document sections table
CREATE TABLE IF NOT EXISTS document_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(384),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
-- Add policies for secure access
DROP POLICY IF EXISTS "Users can insert document sections for their documents" ON document_sections;
CREATE POLICY "Users can insert document sections for their documents" ON document_sections FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM documents
            WHERE documents.id = document_sections.document_id
                AND documents.created_by = auth.uid()
        )
    );
DROP POLICY IF EXISTS "Users can select document sections for their documents" ON document_sections;
CREATE POLICY "Users can select document sections for their documents" ON document_sections FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM documents
            WHERE documents.id = document_sections.document_id
                AND documents.created_by = auth.uid()
        )
    );
DROP POLICY IF EXISTS "Users can delete document sections for their documents" ON document_sections;
CREATE POLICY "Users can delete document sections for their documents" ON document_sections FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM documents
        WHERE documents.id = document_sections.document_id
            AND documents.created_by = auth.uid()
    )
);
-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE
    SET NULL,
        title TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- Add policies for secure access
DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
CREATE POLICY "Users can insert their own conversations" ON conversations FOR
INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
CREATE POLICY "Users can update their own conversations" ON conversations FOR
UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can select their own conversations" ON conversations;
CREATE POLICY "Users can select their own conversations" ON conversations FOR
SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;
CREATE POLICY "Users can delete their own conversations" ON conversations FOR DELETE USING (auth.uid() = user_id);
-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- Add policies for secure access
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
CREATE POLICY "Users can insert their own messages" ON messages FOR
INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can select their own messages" ON messages;
CREATE POLICY "Users can select their own messages" ON messages FOR
SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users cannot update messages" ON messages;
CREATE POLICY "Users cannot update messages" ON messages FOR
UPDATE USING (false);
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages" ON messages FOR DELETE USING (auth.uid() = user_id);
-- Create a view for documents with their storage paths
CREATE OR REPLACE VIEW documents_with_storage_path AS
SELECT d.id,
    d.name,
    d.created_at,
    d.created_by,
    d.storage_object_id,
    d.processed,
    d.processed_at,
    d.status,
    d.file_type,
    d.file_extension,
    storage.objects.name as storage_object_path
FROM documents d
    LEFT JOIN storage.objects ON d.storage_object_id::text = storage.objects.id::text;
-- Create index on document sections for faster text search
CREATE INDEX IF NOT EXISTS idx_document_sections_content_fts ON document_sections USING gin(to_tsvector('english', content));
-- Create index on document sections embedding for faster vector search
CREATE INDEX IF NOT EXISTS idx_document_sections_embedding ON document_sections USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);