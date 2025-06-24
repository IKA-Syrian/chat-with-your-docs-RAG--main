import { supabaseAdmin } from './lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Diagnosing Supabase Storage and Processing Setup...\n');

async function diagnose() {
    const admin = supabaseAdmin();

    // 1. Check if documents bucket exists
    console.log('1️⃣ Checking Storage Buckets...');
    try {
        const { data: buckets, error } = await admin.storage.listBuckets();
        if (error) {
            console.error('❌ Cannot list buckets:', error.message);
        } else {
            console.log('📦 Existing buckets:', buckets.map(b => b.name).join(', '));

            const documentsBucket = buckets.find(b => b.name === 'documents');
            if (!documentsBucket) {
                console.log('⚠️ "documents" bucket does not exist!');
                console.log('🔧 Creating documents bucket...');

                const { data, error: createError } = await admin.storage.createBucket('documents', {
                    public: true,
                    fileSizeLimit: 52428800, // 50MB
                    allowedMimeTypes: ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
                });

                if (createError) {
                    console.error('❌ Failed to create bucket:', createError.message);
                } else {
                    console.log('✅ Documents bucket created successfully!');
                }
            } else {
                console.log('✅ Documents bucket exists');
                console.log('   - Public:', documentsBucket.public);
                console.log('   - File size limit:', documentsBucket.file_size_limit);
            }
        }
    } catch (err) {
        console.error('❌ Storage check error:', err.message);
    }

    // 2. Check database tables
    console.log('\n2️⃣ Checking Database Tables...');
    const requiredTables = ['documents', 'document_sections', 'document_content', 'users'];

    for (const table of requiredTables) {
        try {
            const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true });
            if (error) {
                console.error(`❌ Table "${table}" error:`, error.message);
            } else {
                console.log(`✅ Table "${table}" exists (${count} rows)`);
            }
        } catch (err) {
            console.error(`❌ Cannot access table "${table}":`, err.message);
        }
    }

    // 3. Check required columns
    console.log('\n3️⃣ Checking Table Columns...');
    try {
        // Check if documents table has required columns
        const { data: doc, error } = await admin
            .from('documents')
            .select('id, storage_object_path, public_url')
            .limit(1);

        if (error && error.message.includes('column')) {
            console.log('⚠️ Some columns might be missing in documents table');
            console.log('🔧 Run the schema_fix.sql migration to add missing columns');
        } else {
            console.log('✅ Documents table has required columns');
        }
    } catch (err) {
        console.error('❌ Column check error:', err.message);
    }

    // 4. Check environment variables
    console.log('\n4️⃣ Checking Environment Variables...');
    const envVars = {
        'SUPABASE_URL': process.env.SUPABASE_URL,
        'SUPABASE_SERVICE_KEY': process.env.SUPABASE_SERVICE_KEY,
        'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
        'GEMINI_API_KEY': process.env.GEMINI_API_KEY,
        'OPENROUTER_API_KEY': process.env.OPENROUTER_API_KEY,
        'BACKEND_URL': process.env.BACKEND_URL || 'http://localhost:3001'
    };

    for (const [name, value] of Object.entries(envVars)) {
        if (!value) {
            console.log(`⚠️ ${name} is not set`);
            if (name.includes('API_KEY')) {
                console.log(`   This is required for embeddings/chat functionality`);
            }
        } else {
            console.log(`✅ ${name} is set (${value.substring(0, 20)}...)`);
        }
    }

    // 5. Test file upload
    console.log('\n5️⃣ Testing File Upload to Storage...');
    try {
        const testContent = Buffer.from('Test file content for diagnostic purposes');
        const testPath = `test/${Date.now()}-test.txt`;

        const { data: uploadData, error: uploadError } = await admin.storage
            .from('documents')
            .upload(testPath, testContent, {
                contentType: 'text/plain',
                upsert: false
            });

        if (uploadError) {
            console.error('❌ Test upload failed:', uploadError.message);
        } else {
            console.log('✅ Test upload successful!');
            console.log('   - Path:', testPath);
            console.log('   - ID:', uploadData.id);

            // Clean up test file
            await admin.storage.from('documents').remove([testPath]);
            console.log('🧹 Test file cleaned up');
        }
    } catch (err) {
        console.error('❌ Upload test error:', err.message);
    }

    // 6. Summary and recommendations
    console.log('\n📋 Summary and Recommendations:');
    console.log('================================');
    console.log('1. Make sure to run the schema_fix.sql migration');
    console.log('2. Set up at least one embedding API key (OpenAI, Gemini, or OpenRouter)');
    console.log('3. Ensure the documents bucket exists and is properly configured');
    console.log('4. Check that all required tables exist with proper columns');
    console.log('5. Verify your Supabase service key has admin privileges');
}

diagnose().catch(console.error); 