-- 2026-05-06-005-fsrs-backfill.sql
-- One-time idempotent backfill of legacy `documents.flashcards` JSON into the
-- `flashcards` table. Safe to re-run: keyed on (document_id, fingerprint).
--
-- The JSON shape varies — sometimes { flashcards: [{front, back}, ...] },
-- sometimes [{front, back}, ...] directly. Both are handled.

-- Required for digest() (sha256). No-op if already present.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH cards AS (
    SELECT
        d.id AS document_id,
        ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY ord) - 1 AS card_index,
        elem ->> 'front'    AS front,
        elem ->> 'back'     AS back,
        elem ->> 'question' AS question,
        elem ->> 'answer'   AS answer
    FROM documents d
    -- Try both shapes: jsonb_array_elements on the value itself, or on the .flashcards key.
    CROSS JOIN LATERAL (
        SELECT elem, ord FROM jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(d.flashcards) = 'array' THEN d.flashcards
                WHEN jsonb_typeof(d.flashcards -> 'flashcards') = 'array' THEN d.flashcards -> 'flashcards'
                ELSE '[]'::jsonb
            END
        ) WITH ORDINALITY AS t(elem, ord)
    ) j
    WHERE d.flashcards IS NOT NULL
)
INSERT INTO flashcards (document_id, front, back, card_index, fingerprint)
SELECT
    document_id,
    COALESCE(front, question, '') AS front,
    COALESCE(back,  answer,   '') AS back,
    card_index,
    encode(digest(COALESCE(front, question, '') || '|' || COALESCE(back, answer, ''), 'sha256'), 'hex') AS fingerprint
FROM cards
WHERE COALESCE(front, question, '') <> ''
  AND COALESCE(back,  answer,   '') <> ''
ON CONFLICT (document_id, fingerprint) DO NOTHING;

-- Verify (run interactively):
-- SELECT count(*) AS materialized_cards FROM flashcards;
-- SELECT d.name, count(f.*) FROM documents d LEFT JOIN flashcards f ON f.document_id = d.id GROUP BY d.name;
