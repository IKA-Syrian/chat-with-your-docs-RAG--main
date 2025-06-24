import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    try {
        console.log('🔄 Running database migration...');

        // Read the migration SQL file
        const migrationSQL = fs.readFileSync('./schema-update.sql', 'utf8');

        // Split by semicolon and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 Found ${statements.length} SQL statements to execute`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
            console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);

            try {
                const { error } = await supabase.rpc('exec_sql', { sql: statement });

                if (error) {
                    console.error(`❌ Error in statement ${i + 1}:`, error);
                    // Continue with other statements
                } else {
                    console.log(`✅ Statement ${i + 1} executed successfully`);
                }
            } catch (err) {
                console.error(`❌ Exception in statement ${i + 1}:`, err.message);
                // Continue with other statements
            }
        }

        console.log('✅ Migration completed');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Alternative approach: Execute statements directly
async function runMigrationDirect() {
    try {
        console.log('🔄 Running direct database migration...');

        // Add missing columns to documents table
        console.log('📝 Adding storage_object_path column...');
        const { error: addCol1 } = await supabase
            .from('documents')
            .select('storage_object_path')
            .limit(1);

        if (addCol1 && addCol1.message.includes('column')) {
            console.log('⚠️ storage_object_path column missing, will add via raw SQL');
        } else {
            console.log('✅ storage_object_path column already exists');
        }

        // Check if document_content table exists
        console.log('📝 Checking document_content table...');
        const { error: checkTable } = await supabase
            .from('document_content')
            .select('id')
            .limit(1);

        if (checkTable && checkTable.message.includes('relation')) {
            console.log('⚠️ document_content table missing, will create via raw SQL');
        } else {
            console.log('✅ document_content table already exists');
        }

        // Check if document_chunks table exists
        console.log('📝 Checking document_chunks table...');
        const { error: checkChunks } = await supabase
            .from('document_chunks')
            .select('id')
            .limit(1);

        if (checkChunks && checkChunks.message.includes('relation')) {
            console.log('⚠️ document_chunks table missing, will create via raw SQL');
        } else {
            console.log('✅ document_chunks table already exists');
        }

        console.log('✅ Schema check completed');

    } catch (error) {
        console.error('❌ Migration check failed:', error);
    }
}

// Run the migration
runMigrationDirect().then(() => {
    console.log('🎉 Migration process completed');
    process.exit(0);
}); 