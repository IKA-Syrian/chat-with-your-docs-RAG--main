/**
 * This script creates the necessary tables in the Supabase database.
 * It can be run with: node create-tables.js
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to execute SQL using Supabase's rpc function
async function executeSql(sqlQuery) {
  try {
    console.log('Executing SQL...');

    // Use the rpc function to execute raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query_text: sqlQuery
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('SQL execution error:', error);
    throw error;
  }
}

// Create the exec_sql function in the database if it doesn't exist
async function createSqlFunction() {
  try {
    console.log('Creating SQL execution function...');

    // First check if the function already exists
    const { data: existingFunction, error: checkError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'exec_sql')
      .maybeSingle();

    if (checkError) {
      console.log('Could not check if function exists, will try to create it anyway');
    } else if (existingFunction) {
      console.log('SQL execution function already exists');
      return;
    }

    // Create a stored procedure that can execute arbitrary SQL
    // This requires superuser privileges
    const { error } = await supabase.rpc('create_sql_function', {}, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      }
    });

    if (error) {
      console.error('Could not create SQL function:', error);
      console.log('Will attempt to create tables using direct SQL API instead');
    } else {
      console.log('SQL execution function created successfully');
    }
  } catch (error) {
    console.error('Error creating SQL function:', error);
    console.log('Will attempt to create tables using direct SQL API instead');
  }
}

// Alternative method to execute SQL using direct POST to the SQL endpoint
async function executeSqlDirect(sqlQuery) {
  try {
    console.log('Executing SQL directly...');

    const response = await fetch(`${supabaseUrl}/rest/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({ query: sqlQuery })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SQL execution failed: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Direct SQL execution error:', error);
    throw error;
  }
}

async function createTables() {
  console.log('Starting table creation...');

  try {
    // Try to create the SQL execution function first
    await createSqlFunction();

    // Create documents table directly
    console.log('Creating documents table...');
    const documentsQuery = `
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
            CREATE POLICY "Users can insert their own documents"
                ON documents FOR INSERT
                WITH CHECK (auth.uid() = created_by);
            
            DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
            CREATE POLICY "Users can update their own documents"
                ON documents FOR UPDATE
                USING (auth.uid() = created_by);
            
            DROP POLICY IF EXISTS "Users can select their own documents" ON documents;
            CREATE POLICY "Users can select their own documents"
                ON documents FOR SELECT
                USING (auth.uid() = created_by);
            
            DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;
            CREATE POLICY "Users can delete their own documents"
                ON documents FOR DELETE
                USING (auth.uid() = created_by);
        `;

    try {
      await executeSqlDirect(documentsQuery);
      console.log('Documents table created successfully');
    } catch (documentsError) {
      console.error('Error creating documents table:', documentsError);
    }

    // Create document sections table
    console.log('Creating document sections table...');
    const sectionsQuery = `
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
            CREATE POLICY "Users can insert document sections for their documents"
                ON document_sections FOR INSERT
                WITH CHECK (EXISTS (
                    SELECT 1 FROM documents
                    WHERE documents.id = document_sections.document_id
                    AND documents.created_by = auth.uid()
                ));
            
            DROP POLICY IF EXISTS "Users can select document sections for their documents" ON document_sections;
            CREATE POLICY "Users can select document sections for their documents"
                ON document_sections FOR SELECT
                USING (EXISTS (
                    SELECT 1 FROM documents
                    WHERE documents.id = document_sections.document_id
                    AND documents.created_by = auth.uid()
                ));
            
            DROP POLICY IF EXISTS "Users can delete document sections for their documents" ON document_sections;
            CREATE POLICY "Users can delete document sections for their documents"
                ON document_sections FOR DELETE
                USING (EXISTS (
                    SELECT 1 FROM documents
                    WHERE documents.id = document_sections.document_id
                    AND documents.created_by = auth.uid()
                ));
        `;

    try {
      await executeSqlDirect(sectionsQuery);
      console.log('Document sections table created successfully');
    } catch (sectionsError) {
      console.error('Error creating document sections table:', sectionsError);
    }

    // Create conversations table
    console.log('Creating conversations table...');
    const conversationsQuery = `
            CREATE TABLE IF NOT EXISTS conversations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
                title TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Enable RLS
            ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
            
            -- Add policies for secure access
            DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
            CREATE POLICY "Users can insert their own conversations"
                ON conversations FOR INSERT
                WITH CHECK (auth.uid() = user_id);
            
            DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
            CREATE POLICY "Users can update their own conversations"
                ON conversations FOR UPDATE
                USING (auth.uid() = user_id);
            
            DROP POLICY IF EXISTS "Users can select their own conversations" ON conversations;
            CREATE POLICY "Users can select their own conversations"
                ON conversations FOR SELECT
                USING (auth.uid() = user_id);
            
            DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;
            CREATE POLICY "Users can delete their own conversations"
                ON conversations FOR DELETE
                USING (auth.uid() = user_id);
        `;

    try {
      await executeSqlDirect(conversationsQuery);
      console.log('Conversations table created successfully');
    } catch (conversationsError) {
      console.error('Error creating conversations table:', conversationsError);
    }

    // Create messages table
    console.log('Creating messages table...');
    const messagesQuery = `
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
            CREATE POLICY "Users can insert their own messages"
                ON messages FOR INSERT
                WITH CHECK (auth.uid() = user_id);
            
            DROP POLICY IF EXISTS "Users can select their own messages" ON messages;
            CREATE POLICY "Users can select their own messages"
                ON messages FOR SELECT
                USING (auth.uid() = user_id);
            
            DROP POLICY IF EXISTS "Users cannot update messages" ON messages;
            CREATE POLICY "Users cannot update messages"
                ON messages FOR UPDATE
                USING (false);
            
            DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
            CREATE POLICY "Users can delete their own messages"
                ON messages FOR DELETE
                USING (auth.uid() = user_id);
        `;

    try {
      await executeSqlDirect(messagesQuery);
      console.log('Messages table created successfully');
    } catch (messagesError) {
      console.error('Error creating messages table:', messagesError);
    }

    // Create views and indexes
    console.log('Creating views and indexes...');
    const viewsQuery = `
            -- Create a view for documents with their storage paths
            CREATE OR REPLACE VIEW documents_with_storage_path AS
            SELECT 
                d.id,
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
            FROM 
                documents d
            LEFT JOIN 
                storage.objects ON d.storage_object_id::text = storage.objects.id::text;
                
            -- Create index on document sections for faster text search
            CREATE INDEX IF NOT EXISTS idx_document_sections_content_fts ON document_sections
            USING gin(to_tsvector('english', content));
            
            -- Create index on document sections embedding for faster vector search
            CREATE INDEX IF NOT EXISTS idx_document_sections_embedding ON document_sections
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        `;

    try {
      await executeSqlDirect(viewsQuery);
      console.log('Views and indexes created successfully');
    } catch (viewsError) {
      console.error('Error creating views and indexes:', viewsError);
    }

    console.log('Table creation completed!');
  } catch (error) {
    console.error('Unexpected error during table creation:', error);
  }
}

createTables()
  .then(() => {
    console.log('Setup completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error during setup:', err);
    process.exit(1);
  }); 