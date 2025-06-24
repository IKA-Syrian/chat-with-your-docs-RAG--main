import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';

config();

// Supabase admin client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing Supabase URL or service role key');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function setupDatabase() {
    console.log('Setting up database...');

    try {
        // Create the check_column_exists function
        console.log('Creating check_column_exists function...');
        const { error: fnError } = await supabaseAdmin.rpc('create_check_column_function');

        if (fnError) {
            if (fnError.message.includes('already exists')) {
                console.log('Function check_column_exists already exists');
            } else {
                console.error('Error creating check_column_exists function:', fnError);
            }
        } else {
            console.log('Function check_column_exists created successfully');
        }

        console.log('Database setup completed successfully');
    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    }
}

if (process.argv[2] === '--run') {
    setupDatabase()
        .then(() => {
            console.log('Database setup script completed.');
            process.exit(0);
        })
        .catch(error => {
            console.error('Database setup script failed:', error);
            process.exit(1);
        });
} else {
    console.log('Run with --run to execute this script');
}
