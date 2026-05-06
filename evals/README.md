# StudyAI eval harness

A regression suite that re-runs a fixed set of (document, question, expected) tuples
against the live `/chat` endpoint and grades the answers. Goal: catch quality drift
when prompts, models, or retrieval logic change.

## Run

```bash
# Make sure backend is running on http://localhost:3001 (or set EVAL_BASE_URL).
# Set EVAL_AUTH_TOKEN to a valid Supabase JWT (copy from your browser localStorage).

npm run eval                    # runs all fixtures
npm run eval -- --filter=swot   # only fixtures whose id contains "swot"
npm run eval -- --json          # machine-readable output (CI)
```

## Fixture format

`evals/fixtures/*.json` — each file is one fixture:

```json
{
  "id": "swot-basic",
  "description": "Asks for SWOT meaning when document mentions it without defining",
  "document_id": "REPLACE_WITH_REAL_DOC_ID",
  "question": "What does SWOT stand for?",
  "explain_mode": "default",
  "expected_keywords": ["strengths", "weaknesses", "opportunities", "threats"],
  "forbidden_keywords": ["i don't know", "no information"],
  "min_sources": 1
}
```

## Metrics (v1)

- **keyword_recall** — fraction of `expected_keywords` present (case-insensitive) in the answer.
- **forbidden_hits** — count of `forbidden_keywords` present (lower is better).
- **source_count** — number of citations returned. Compared against `min_sources`.
- **latency_ms** — round-trip time.
- **tokens / cost** — taken from the response `usage` field.

A fixture is **PASS** if:
- `keyword_recall >= 1.0`
- `forbidden_hits == 0`
- `source_count >= min_sources`

## Adding a fixture

1. Pick a real document from your DB and copy its `document_id`.
2. Pick a question whose ground-truth answer you know.
3. Write 2–5 unambiguous `expected_keywords` (avoid stop-words).
4. Save as `evals/fixtures/<short-id>.json`.

## CI integration (later)

```yaml
# .github/workflows/evals.yml — sketched, not yet wired
- run: npm run eval -- --json > eval-report.json
- uses: actions/upload-artifact@v4
  with: { name: eval-report, path: eval-report.json }
```
