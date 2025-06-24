-- IMPORTANT: Run this SQL in your Supabase Dashboard SQL Editor
-- This will fix the storage upload issue
-- Drop the problematic storage trigger that's blocking uploads
DROP TRIGGER IF EXISTS on_storage_object_created ON storage.objects;
-- Verify it was dropped
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'storage'
    AND event_object_table = 'objects';
-- The result should be empty (no triggers)