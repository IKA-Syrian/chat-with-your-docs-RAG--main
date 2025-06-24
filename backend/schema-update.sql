-- Schema updates for chat-with-docs RAG application
-- Run this script to add missing tables and columns
-- Add missing columns to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS storage_object_path TEXT;
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS public_url TEXT;
-- Create document_content table for direct file storage
CREATE TABLE IF NOT EXISTS document_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS for document_content
ALTER TABLE document_content ENABLE ROW LEVEL SECURITY;
-- Add policies for document_content
DROP POLICY IF EXISTS "Users can insert document content for their documents" ON document_content;
CREATE POLICY "Users can insert document content for their documents" ON document_content FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM documents
            WHERE documents.id = document_content.document_id
                AND documents.created_by = auth.uid()
        )
    );
DROP POLICY IF EXISTS "Users can select document content for their documents" ON document_content;
CREATE POLICY "Users can select document content for their documents" ON document_content FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM documents
            WHERE documents.id = document_content.document_id
                AND documents.created_by = auth.uid()
        )
    );
DROP POLICY IF EXISTS "Users can delete document content for their documents" ON document_content;
CREATE POLICY "Users can delete document content for their documents" ON document_content FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM documents
        WHERE documents.id = document_content.document_id
            AND documents.created_by = auth.uid()
    )
);
-- Create document_chunks table for embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    -- Standard embedding dimension
    chunk_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS for document_chunks
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
-- Add policies for document_chunks
DROP POLICY IF EXISTS "Users can insert document chunks for their documents" ON document_chunks;
CREATE POLICY "Users can insert document chunks for their documents" ON document_chunks FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM documents
            WHERE documents.id = document_chunks.document_id
                AND documents.created_by = auth.uid()
        )
    );
DROP POLICY IF EXISTS "Users can select document chunks for their documents" ON document_chunks;
CREATE POLICY "Users can select document chunks for their documents" ON document_chunks FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM documents
            WHERE documents.id = document_chunks.document_id
                AND documents.created_by = auth.uid()
        )
    );
DROP POLICY IF EXISTS "Users can delete document chunks for their documents" ON document_chunks;
CREATE POLICY "Users can delete document chunks for their documents" ON document_chunks FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM documents
        WHERE documents.id = document_chunks.document_id
            AND documents.created_by = auth.uid()
    )
);
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_content_document_id ON document_content(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- Create a function to search document chunks by similarity
CREATE OR REPLACE FUNCTION search_document_chunks(
        query_embedding VECTOR(1536),
        match_threshold FLOAT DEFAULT 0.5,
        match_count INT DEFAULT 10
    ) RETURNS TABLE (
        chunk_id UUID,
        document_id UUID,
        content TEXT,
        similarity FLOAT
    ) LANGUAGE SQL AS $$
SELECT document_chunks.id as chunk_id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
FROM document_chunks
WHERE 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
ORDER BY document_chunks.embedding <=> query_embedding
LIMIT match_count;
$$;