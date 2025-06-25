# Analytics Database Migration

## Problem

The analytics system was failing to create sessions for general browsing activities because the database schema required a `document_id` for all sessions, but we want to support general browsing sessions without specific document context.

## Solution

This migration makes the `document_id` column nullable in all analytics tables, allowing the system to track:

-   Document-specific study sessions
-   General browsing sessions
-   Mixed activity tracking

## Files Created

### 1. `fix-document-id-nullable.sql`

SQL migration script that:

-   Makes `document_id` nullable in `study_sessions`, `learning_attempts`, and `quiz_completions` tables
-   Updates the analytics function to handle null document IDs
-   Adds comments documenting the schema changes

### 2. `run-document-id-migration.js`

JavaScript script that:

-   Executes the SQL migration
-   Tests the migration by creating a test session with null document_id
-   Provides detailed console output
-   Cleans up test data

## How to Run the Migration

### Option 1: Using the JavaScript Script (Recommended)

```bash
cd backend
node run-document-id-migration.js
```

### Option 2: Manual SQL Execution

1. Copy the contents of `fix-document-id-nullable.sql`
2. Run it in your Supabase SQL Editor or PostgreSQL client

## Verification

After running the migration, you should see:

-   ✅ Session tracking works for browsing activities
-   ✅ Analytics page loads without errors
-   ✅ Both document-specific and general sessions are tracked

## What This Enables

### Before Migration

-   ❌ 500 errors when starting browsing sessions
-   ❌ "document_id cannot be null" database constraint violations
-   ❌ Analytics only worked with document-specific activities

### After Migration

-   ✅ General browsing sessions (files page, navigation)
-   ✅ Document-specific study sessions
-   ✅ Chat sessions with and without documents
-   ✅ Mixed activity tracking across the entire app
-   ✅ Comprehensive analytics dashboard

## Schema Changes

```sql
-- Before
document_id TEXT NOT NULL

-- After
document_id TEXT -- nullable to allow general browsing sessions
```

## Future Deployments

The original `create-analytics-tables.sql` file has been updated with the correct nullable schema, so new deployments will automatically have the correct structure.

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- WARNING: This will fail if you have sessions with null document_id
ALTER TABLE study_sessions ALTER COLUMN document_id SET NOT NULL;
ALTER TABLE learning_attempts ALTER COLUMN document_id SET NOT NULL;
ALTER TABLE quiz_completions ALTER COLUMN document_id SET NOT NULL;
```

Note: Rollback will only work if you delete all sessions with null document_id first.
