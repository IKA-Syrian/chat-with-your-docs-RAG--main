// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Pool } = pg;

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Check your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorageObjectsTable() {
    try {
        console.log('Checking storage.objects table structure...');

        // First try to get a sample object to see what's available
        const { data: storageObjects, error: storageError } = await supabase.storage
            .from('files')
            .list('', { limit: 1 });

        if (storageError) {
            console.error('Error listing storage objects:', storageError);
        } else {
            console.log('Sample storage object from list:', storageObjects[0]);
        }

        // Try to query the documents table to see the structure
        const { data: documents, error: documentsError } = await supabase
            .from('documents')
            .select('*')
            .limit(1);

        if (documentsError) {
            console.error('Error querying documents table:', documentsError);
        } else {
            console.log('\nSample document:', documents[0]);

            if (documents[0]?.storage_object_id) {
                console.log('\nStorage object ID type:', typeof documents[0].storage_object_id);
                console.log('Storage object ID value:', documents[0].storage_object_id);
            }
        }

        // If we have a DATABASE_URL, try direct connection
        if (dbUrl) {
            console.log('\nAttempting direct database connection...');
            const pool = new Pool({
                connectionString: dbUrl,
            });

            try {
                const client = await pool.connect();
                try {
                    // Check storage.objects table structure
                    const objectsResult = await client.query(`
                        SELECT column_name, data_type 
                        FROM information_schema.columns 
                        WHERE table_schema = 'storage' 
                        AND table_name = 'objects'
                    `);

                    console.log('\nStorage.objects columns from direct DB connection:');
                    objectsResult.rows.forEach(row => {
                        console.log(`- ${row.column_name} (${row.data_type})`);
                    });

                    // Check documents table structure
                    const documentsResult = await client.query(`
                        SELECT column_name, data_type 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'documents'
                    `);

                    console.log('\nDocuments columns from direct DB connection:');
                    documentsResult.rows.forEach(row => {
                        console.log(`- ${row.column_name} (${row.data_type})`);
                    });
                } finally {
                    client.release();
                }
            } catch (dbError) {
                console.error('Database connection error:', dbError);
            } finally {
                await pool.end();
            }
        }

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

// Run the function
checkStorageObjectsTable()
    .then(() => {
        console.log('\nCheck completed!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error during check:', err);
        process.exit(1);
    }); 