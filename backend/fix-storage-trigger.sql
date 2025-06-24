-- Fix Storage Trigger Issue
-- The storage trigger is trying to insert into documents table without proper created_by value
-- Check existing triggers
SELECT trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'storage'
    AND event_object_table = 'objects';
-- Option 1: Drop the problematic trigger completely
DROP TRIGGER IF EXISTS on_storage_object_created ON storage.objects;
-- Option 2: If you want to keep auto-document creation, recreate it properly
-- This version checks if we're uploading to documents bucket and handles it correctly
/*
 CREATE OR REPLACE FUNCTION handle_storage_upload() RETURNS trigger AS $$
 BEGIN
 -- Only process files in the documents bucket
 IF NEW.bucket_id = 'documents' THEN
 -- Extract user_id from the path (assuming format: user_id/document_id/filename)
 DECLARE
 path_parts text[];
 user_id uuid;
 BEGIN
 path_parts := string_to_array(NEW.name, '/');
 IF array_length(path_parts, 1) >= 3 THEN
 BEGIN
 user_id := path_parts[1]::uuid;
 
 -- Only insert if document doesn't already exist
 INSERT INTO public.documents (
 id,
 name, 
 created_by,
 storage_object_id,
 storage_object_path,
 file_type,
 status
 )
 SELECT
 path_parts[2]::uuid, -- document_id from path
 path_parts[3], -- filename
 user_id,
 NEW.id::text,
 NEW.name,
 NEW.metadata->>'mimetype',
 'uploaded'
 WHERE NOT EXISTS (
 SELECT 1 FROM public.documents 
 WHERE id = path_parts[2]::uuid
 );
 EXCEPTION WHEN others THEN
 -- Log error but don't fail the storage upload
 RAISE WARNING 'Could not create document record: %', SQLERRM;
 END;
 END IF;
 END;
 END IF;
 
 RETURN NEW;
 END;
 $$ LANGUAGE plpgsql;
 
 -- Recreate trigger only if you want auto-document creation
 CREATE TRIGGER on_storage_object_created
 AFTER INSERT ON storage.objects
 FOR EACH ROW
 EXECUTE FUNCTION handle_storage_upload();
 */
-- For now, let's just drop the trigger to allow uploads to work
-- The application code already handles document creation properly