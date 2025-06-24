-- Create document_content table for direct uploads first
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS document_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS
ALTER TABLE document_content ENABLE ROW LEVEL SECURITY;
-- Check if documents table exists and its ID column type
DO $$
DECLARE doc_id_type text;
storage_id_type text;
BEGIN -- Check if the documents table exists and get the data type of the id column
SELECT data_type INTO doc_id_type
FROM information_schema.columns
WHERE table_name = 'documents'
    AND column_name = 'id';
-- Also check storage.objects.id type
SELECT data_type INTO storage_id_type
FROM information_schema.columns
WHERE table_schema = 'storage'
    AND table_name = 'objects'
    AND column_name = 'id';
-- Log the types for debugging
RAISE NOTICE 'Documents id type: %, Storage objects id type: %',
doc_id_type,
storage_id_type;
-- If the documents table exists with a bigint id
IF doc_id_type = 'bigint' THEN -- Drop dependent tables with CASCADE to handle dependencies
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS document_sections CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
RAISE NOTICE 'Dropped existing tables with incompatible types';
ELSIF doc_id_type IS NOT NULL THEN RAISE NOTICE 'Documents table exists with id type: %',
doc_id_type;
ELSE RAISE NOTICE 'Documents table does not exist, will create new';
END IF;
END $$;
-- Try to fix the storage.objects table owner_id column type issue
DO $$ BEGIN -- Check if the function already exists
IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'convert_uuid_to_text_for_storage'
) THEN -- Create a function to handle the conversion
EXECUTE 'CREATE OR REPLACE FUNCTION storage.convert_uuid_to_text_for_storage()
        RETURNS TRIGGER AS $BODY$
        BEGIN
            -- Convert UUID to text to avoid type mismatch
            IF NEW.owner_id IS NOT NULL AND NEW.owner_id::text ~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' THEN
                -- It''s a UUID, convert to string representation
                NEW.owner_id = NEW.owner_id::text;
            END IF;
            RETURN NEW;
        END;
        $BODY$ LANGUAGE plpgsql;';
-- Create a trigger to run before insert
EXECUTE 'CREATE TRIGGER convert_uuid_before_insert
        BEFORE INSERT ON storage.objects
        FOR EACH ROW
        EXECUTE FUNCTION storage.convert_uuid_to_text_for_storage();';
RAISE NOTICE 'Created UUID conversion trigger for storage.objects table';
ELSE RAISE NOTICE 'UUID conversion function already exists';
END IF;
EXCEPTION
WHEN OTHERS THEN RAISE NOTICE 'Could not create UUID conversion trigger: %',
SQLERRM;
END $$;
-- Create a stored procedure to create documents with proper type casting
CREATE OR REPLACE FUNCTION create_document_with_cast(
        doc_name TEXT,
        storage_id TEXT,
        user_id UUID,
        file_mimetype TEXT,
        file_ext TEXT
    ) RETURNS UUID AS $$
DECLARE new_document_id UUID;
BEGIN -- Insert document with explicit casting of storage_id to TEXT
INSERT INTO documents (
        id,
        name,
        created_by,
        storage_object_id,
        file_type,
        file_extension
    )
VALUES (
        uuid_generate_v4(),
        doc_name,
        user_id,
        storage_id::TEXT,
        -- Explicitly cast to TEXT
        file_mimetype,
        file_ext
    )
RETURNING id INTO new_document_id;
RETURN new_document_id;
END;
$$ LANGUAGE plpgsql;
-- Ensure required auxiliary tables -------------------------------------------
-- -------------------------------------------------------------------------
-- Create a simple `public.users` mirror table BEFORE we reference it from
-- the `documents` table.  Using IF NOT EXISTS prevents errors if it is
-- already present (for example, created by a previous migration).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Create documents table with UUID primary key
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    storage_object_id TEXT,
    -- Changed from UUID to TEXT to match Supabase storage.objects.id
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
-- Check if pgvector extension exists before creating vector index
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'vector'
) THEN -- Create index on document sections embedding for faster vector search
BEGIN CREATE INDEX IF NOT EXISTS idx_document_sections_embedding ON document_sections USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
EXCEPTION
WHEN OTHERS THEN RAISE NOTICE 'Could not create vector index: %',
SQLERRM;
END;
ELSE RAISE NOTICE 'pgvector extension is not installed. Vector index not created.';
END IF;
END $$;
-- Recreate the match_document_sections function if it existed before
DO $$ BEGIN -- Create the function with the new table structure
CREATE OR REPLACE FUNCTION match_document_sections(
        query_embedding VECTOR(384),
        match_threshold FLOAT,
        match_count INT,
        document_id UUID DEFAULT NULL
    ) RETURNS TABLE (
        id UUID,
        document_id UUID,
        content TEXT,
        similarity FLOAT
    ) LANGUAGE plpgsql AS $function$ BEGIN RETURN QUERY
SELECT ds.id,
    ds.document_id,
    ds.content,
    1 - (ds.embedding <=> query_embedding) AS similarity
FROM document_sections ds
WHERE ds.embedding IS NOT NULL
    AND (
        document_id IS NULL
        OR ds.document_id = match_document_sections.document_id
    )
    AND 1 - (ds.embedding <=> query_embedding) > match_threshold
ORDER BY ds.embedding <=> query_embedding
LIMIT match_count;
END;
$function$;
RAISE NOTICE 'match_document_sections function created or replaced';
EXCEPTION
WHEN OTHERS THEN RAISE NOTICE 'Error creating match_document_sections function: %',
SQLERRM;
END $$;
-- Create document_content table for direct uploads
CREATE TABLE IF NOT EXISTS document_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS
ALTER TABLE document_content ENABLE ROW LEVEL SECURITY;
-- Add policies for secure access
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
-- Attempt to create an RLS policy on the `documents` bucket so each user can
-- only manage files in their own folder.  This requires ownership on
-- storage.objects.  If the current role lacks permission we log a NOTICE and
-- continue so the rest of the migration doesn't fail.
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
        AND c.relname = 'objects'
) THEN BEGIN
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION
WHEN others THEN RAISE NOTICE 'Could not enable RLS on storage.objects: %',
SQLERRM;
END;
BEGIN DROP POLICY IF EXISTS "Users can manage their own files" ON storage.objects;
EXCEPTION
WHEN others THEN RAISE NOTICE 'Could not drop existing storage policy: %',
SQLERRM;
END;
BEGIN CREATE POLICY "Users can manage their own files" ON storage.objects FOR ALL USING (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = auth.uid()
);
EXCEPTION
WHEN others THEN RAISE NOTICE 'Could not create storage.objects policy (lack privileges?): %',
SQLERRM;
END;
END IF;
END $$;