# Migrations

Run these in order against your Supabase database (Studio → SQL Editor, or `psql`).
All migrations are **additive** — they add columns/tables/functions but do not
drop or modify existing data.

## Order

### Phase 2 migrations
1. `2026-05-06-001-security-events.sql` — log table for prompt-injection flags
2. `2026-05-06-002-parent-chunks.sql` — `parent_chunk_id`, `chunk_level`, `page_number`, `chunk_index` on `document_sections`
3. `2026-05-06-003-hybrid-search.sql` — `content_tsv` column + `hybrid_match_document_sections` RPC
4. `2026-05-06-004-fsrs.sql` — `flashcards` + `flashcard_reviews` tables and RLS
5. `2026-05-06-005-fsrs-backfill.sql` — one-time backfill of legacy JSON flashcards into rows

### Phase 3 migrations
6. `2026-05-06-006-ocr-and-source.sql` — `documents.ocr_used / ocr_provider / ocr_model / source_kind / source_url` + `ocr_cache` table
7. `2026-05-06-007-multi-doc-search.sql` — overload of `hybrid_match_document_sections` accepting `UUID[]` + `conversations.document_ids`
8. `2026-05-06-008-card-variety.sql` — `flashcards.card_type / cloze_text / expected_answer` + `short_answer_attempts` table
9. `2026-05-06-009-mistake-journal.sql` — unified `wrong_answers` table

### Phase 4 migrations
10. `2026-05-06-010-knowledge-graph.sql` — `knowledge_graphs(document_id JSONB nodes/edges)` + RLS
11. `2026-05-06-011-sharing.sql` — `can_read_document` / `can_write_document` helpers, `document_shares`, `document_invites`, expanded SELECT policies
12. `2026-05-06-012-public-decks.sql` — `documents.published / tags / forked_from / upvotes_count` + `deck_upvotes` + `fork_document` RPC + public SELECT policies

## Lock notes (read before running on a populated DB)

- **003-hybrid-search.sql** adds a `GENERATED ALWAYS AS ... STORED` column.
  Postgres rewrites the entire `document_sections` table and holds an
  `ACCESS EXCLUSIVE` lock for the duration. On a multi-GB table this can
  block reads/writes for minutes. Run during a maintenance window.
- **002-parent-chunks.sql** only adds nullable columns and a few indexes —
  fast and doesn't rewrite the table.
- **001 / 004 / 005** all create new tables and don't touch existing rows
  beyond the explicit backfill.

## Verify

After running, confirm:

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'document_sections';
-- Should include: parent_chunk_id, chunk_level, page_number, chunk_index, content_tsv

SELECT proname FROM pg_proc WHERE proname = 'hybrid_match_document_sections';
-- Should return 1 row

SELECT count(*) FROM flashcards;
SELECT count(*) FROM flashcard_reviews;
```
