import { supabaseAdmin } from './lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function fixStorageBucket() {
    const admin = supabaseAdmin();

    console.log('🔧 Fixing storage bucket configuration...\n');

    try {
        // 1. Update bucket to be public
        console.log('1️⃣ Making documents bucket public...');
        const { data: updateData, error: updateError } = await admin.storage.updateBucket('documents', {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: [
                'application/pdf',
                'text/plain',
                'text/markdown',
                'text/csv',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ]
        });

        if (updateError) {
            console.error('❌ Failed to update bucket:', updateError.message);
        } else {
            console.log('✅ Documents bucket is now public');
        }

        // 2. Test upload without trigger interference
        console.log('\n2️⃣ Testing direct storage upload...');
        const testContent = Buffer.from('Test file content for storage test');
        const testPath = `test/storage-test-${Date.now()}.txt`;

        const { data: uploadData, error: uploadError } = await admin.storage
            .from('documents')
            .upload(testPath, testContent, {
                contentType: 'text/plain',
                upsert: false
            });

        if (uploadError) {
            console.error('❌ Test upload failed:', uploadError.message);

            // If failed due to trigger, suggest fix
            if (uploadError.message.includes('documents') && uploadError.message.includes('created_by')) {
                console.log('\n⚠️  Storage trigger is interfering with uploads!');
                console.log('📝 To fix this, run the following SQL in your Supabase dashboard:');
                console.log('');
                console.log('-- Option 1: Disable the trigger');
                console.log('DROP TRIGGER IF EXISTS on_storage_object_created ON storage.objects;');
                console.log('');
                console.log('-- Option 2: Or modify the trigger to handle bucket names properly');
                console.log('-- (The trigger might be looking for "files" bucket instead of "documents")');
            }
        } else {
            console.log('✅ Test upload successful!');
            console.log('   - Path:', testPath);
            console.log('   - ID:', uploadData.id);

            // Get public URL
            const { data: urlData } = admin.storage
                .from('documents')
                .getPublicUrl(testPath);
            console.log('   - Public URL:', urlData.publicUrl);

            // Clean up test file
            await admin.storage.from('documents').remove([testPath]);
            console.log('🧹 Test file cleaned up');
        }

        // 3. Check existing documents
        console.log('\n3️⃣ Checking existing documents in storage...');
        const { data: files, error: listError } = await admin.storage
            .from('documents')
            .list('', {
                limit: 100,
                offset: 0
            });

        if (listError) {
            console.error('❌ Failed to list files:', listError.message);
        } else {
            console.log(`📁 Found ${files?.length || 0} files in documents bucket`);
            if (files && files.length > 0) {
                files.slice(0, 5).forEach(file => {
                    console.log(`   - ${file.name} (${file.metadata?.size || 0} bytes)`);
                });
                if (files.length > 5) {
                    console.log(`   ... and ${files.length - 5} more`);
                }
            }
        }

    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
    }
}

fixStorageBucket().catch(console.error); 