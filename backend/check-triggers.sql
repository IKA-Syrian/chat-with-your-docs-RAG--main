-- Check for triggers on storage.objects table
SELECT tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    proname AS function_name
FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'storage.objects'::regclass;
-- Check for triggers that might insert into documents table
SELECT n.nspname AS schema_name,
    c.relname AS table_name,
    t.tgname AS trigger_name,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
WHERE pg_get_functiondef(p.oid) LIKE '%documents%'
    OR p.proname LIKE '%document%';
-- List all triggers in the database
SELECT event_object_schema AS schema_name,
    event_object_table AS table_name,
    trigger_name,
    event_manipulation AS trigger_event,
    action_statement AS trigger_function
FROM information_schema.triggers
WHERE event_object_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY event_object_schema,
    event_object_table;
-- Check if there's a specific trigger causing the issue
SELECT *
FROM information_schema.triggers
WHERE event_object_table = 'objects'
    AND event_object_schema = 'storage';