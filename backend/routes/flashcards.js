/**
 * @swagger
 * tags:
 *   name: Flashcards
 *   description: Spaced-repetition flashcard review (FSRS)
 */

import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import { validateUser } from './auth.js';
import { updateFSRS, FSRS_RATINGS } from '../lib/fsrs.js';
import aiProviderManager from '../lib/ai-providers.js';

const router = Router();

async function authedSupabase(req, res) {
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    if (!authToken) {
        res.status(401).json({ error: 'No authorization token provided' });
        return null;
    }
    const { user, error } = await validateUser(authToken);
    if (error || !user) {
        res.status(401).json({ error: 'User not authenticated' });
        return null;
    }
    return { supabase: createUserClient(authToken), user };
}

/**
 * GET /flashcards/due
 * Returns flashcards due for review for the current user.
 *
 * Query params:
 *   limit       (default 25, max 200)
 *   document_id (optional — only cards from this document)
 *
 * A card is "due" if:
 *   - it has no flashcard_reviews row for this user (treated as new), OR
 *   - its existing review row has due_at <= now()
 */
router.get('/due', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;

    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 200);
    const documentId = req.query.document_id || null;

    try {
        // Strategy: pull candidate cards, then left-join review state in JS.
        // Postgres-side LATERAL would be faster, but Supabase's PostgREST doesn't
        // expose it cleanly — we keep this simple and let the DB indexes handle it.

        // Try the full select (Phase 3 columns); fall back to the legacy shape if
        // the migration hasn't been applied yet.
        const buildQuery = (selectClause) => {
            let q = supabase.from('flashcards')
                .select(selectClause)
                .order('created_at', { ascending: true })
                .limit(limit * 4);
            if (documentId) q = q.eq('document_id', documentId);
            return q;
        };
        let { data: cards, error: cardErr } = await buildQuery(
            'id, document_id, front, back, card_index, source_chunk_id, card_type, cloze_text, expected_answer, created_at'
        );
        if (cardErr && /column.*does not exist|card_type|cloze_text|expected_answer/i.test(cardErr.message || '')) {
            ({ data: cards, error: cardErr } = await buildQuery(
                'id, document_id, front, back, card_index, source_chunk_id, created_at'
            ));
        }
        if (cardErr) return res.status(400).json({ error: cardErr.message });
        if (!cards || cards.length === 0) return res.json({ cards: [] });

        const cardIds = cards.map(c => c.id);
        const { data: reviews, error: revErr } = await supabase
            .from('flashcard_reviews')
            .select('flashcard_id, due_at, stability, difficulty, reps, lapses, state, last_review, last_rating')
            .eq('user_id', user.id)
            .in('flashcard_id', cardIds);
        if (revErr) return res.status(400).json({ error: revErr.message });

        const reviewByCard = new Map((reviews || []).map(r => [r.flashcard_id, r]));
        const now = Date.now();
        const due = cards
            .map(c => ({ ...c, review: reviewByCard.get(c.id) || null }))
            .filter(c => !c.review || new Date(c.review.due_at).getTime() <= now)
            .slice(0, limit);

        res.json({ cards: due, ratings: FSRS_RATINGS });
    } catch (err) {
        console.error('GET /flashcards/due error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /flashcards/:id/review
 * Body: { rating: 1|2|3|4 }
 * Applies FSRS update for the current user and returns the new review state.
 */
router.post('/:id/review', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;

    const flashcardId = req.params.id;
    const rating = parseInt(req.body?.rating, 10);

    if (!flashcardId) return res.status(400).json({ error: 'Missing flashcard id' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 4) {
        return res.status(400).json({ error: 'rating must be an integer 1..4' });
    }

    try {
        // Confirm the card exists and the user owns the underlying document.
        // RLS would also enforce this, but we want a clean error message.
        const { data: card, error: cardErr } = await supabase
            .from('flashcards')
            .select('id, document_id, front, back')
            .eq('id', flashcardId)
            .single();
        if (cardErr || !card) return res.status(404).json({ error: 'Flashcard not found' });

        // Load existing review state (may be null on first review).
        const { data: existing } = await supabase
            .from('flashcard_reviews')
            .select('*')
            .eq('flashcard_id', flashcardId)
            .eq('user_id', user.id)
            .maybeSingle();

        const next = updateFSRS(existing || {}, rating);

        const upsertRow = {
            flashcard_id: flashcardId,
            user_id: user.id,
            ...next,
            updated_at: new Date().toISOString()
        };

        const { data: saved, error: upsertErr } = await supabase
            .from('flashcard_reviews')
            .upsert(upsertRow, { onConflict: 'flashcard_id,user_id' })
            .select()
            .single();

        if (upsertErr) return res.status(400).json({ error: upsertErr.message });

        // Phase 3 #9 — feed mistake journal on Again. Idempotent (skip when
        // an unresolved row for this card already exists).
        if (rating === 1) {
            try {
                const { data: existingMistake } = await supabase
                    .from('wrong_answers')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('source_kind', 'flashcard')
                    .eq('source_id', flashcardId)
                    .eq('resolved', false)
                    .maybeSingle();

                if (!existingMistake) {
                    await supabase.from('wrong_answers').insert({
                        user_id: user.id,
                        document_id: card.document_id,
                        source_kind: 'flashcard',
                        source_id: flashcardId,
                        question: card.front || '(flashcard)',
                        expected_answer: card.back || null,
                        details: { rating: 1, reps: next.reps, last_review: next.last_review }
                    });
                }
            } catch (journalErr) {
                if (journalErr.code !== '42P01' && !/does not exist/i.test(journalErr.message || '')) {
                    console.warn('⚠️  wrong_answers insert (flashcard) failed:', journalErr.message);
                }
            }
        }

        res.json({ review: saved });
    } catch (err) {
        console.error('POST /flashcards/:id/review error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /flashcards/:id/grade-answer
 * Body: { user_answer: string }
 *
 * Phase 3 #7 — LLM-as-judge grading for short-answer cards. Uses the
 * configured chat provider to score the user's answer against the card's
 * `expected_answer`, returns a 0..1 score and 1..4 FSRS rating suggestion,
 * and persists to short_answer_attempts. If score < 0.5, also creates a
 * row in wrong_answers for the mistake journal.
 */
router.post('/:id/grade-answer', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;

    const flashcardId = req.params.id;
    const userAnswer = (req.body?.user_answer || '').toString().slice(0, 5000);
    if (!flashcardId) return res.status(400).json({ error: 'Missing flashcard id' });
    if (!userAnswer.trim()) return res.status(400).json({ error: 'user_answer required' });

    try {
        const { data: card, error: cardErr } = await supabase
            .from('flashcards')
            .select('id, document_id, front, back, expected_answer, source_chunk_id')
            .eq('id', flashcardId)
            .single();
        if (cardErr || !card) return res.status(404).json({ error: 'Flashcard not found' });

        const expected = card.expected_answer || card.back || '';
        if (!expected) return res.status(400).json({ error: 'Card has no expected answer to grade against' });

        // LLM-as-judge — ask the configured chat provider for a structured score.
        let score = 0;
        let feedback = '';
        let matched = [];
        let missing = [];
        try {
            const provider = aiProviderManager.getProvider();
            const judgePrompt = [
                {
                    role: 'system',
                    content: `You are a strict but fair short-answer grader. Score the student's answer against the model answer on a 0.0–1.0 scale.

Output ONLY a JSON object on a single line, with no prose, no markdown, no code fences:
{"score": <0..1>, "feedback": "<1-2 sentences directed at the student>", "matched_keywords": ["..."], "missing_keywords": ["..."]}

Rules:
- 1.0 = fully correct and complete.
- 0.6–0.9 = correct gist with minor omissions.
- 0.3–0.5 = partial credit; key idea present but important pieces missing.
- 0.0–0.2 = wrong or empty.
- Be generous with synonyms and paraphrases of the model answer; be strict on factual errors.`
                },
                {
                    role: 'user',
                    content: `QUESTION:\n${card.front}\n\nMODEL ANSWER:\n${expected}\n\nSTUDENT ANSWER:\n${userAnswer}`
                }
            ];
            const judgeResp = await provider.chat(judgePrompt, { temperature: 0.0, max_tokens: 400 });
            const raw = (judgeResp.content || '').trim()
                .replace(/^```(?:json)?/i, '')
                .replace(/```$/, '')
                .trim();

            // Try parsing the whole response first (best case: model obeyed
            // "JSON object on a single line"). Fall back to a robust balanced-
            // brace extraction so we don't greedy-match across stray braces.
            let parsed = null;
            try {
                parsed = JSON.parse(raw);
            } catch {
                const start = raw.indexOf('{');
                if (start >= 0) {
                    let depth = 0, inStr = false, escape = false, end = -1;
                    for (let i = start; i < raw.length; i++) {
                        const ch = raw[i];
                        if (inStr) {
                            if (escape) { escape = false; continue; }
                            if (ch === '\\') { escape = true; continue; }
                            if (ch === '"') inStr = false;
                            continue;
                        }
                        if (ch === '"') { inStr = true; continue; }
                        if (ch === '{') depth++;
                        else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
                    }
                    if (end > start) {
                        try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { /* ignore */ }
                    }
                }
            }

            if (parsed && typeof parsed === 'object') {
                score = Math.max(0, Math.min(1, Number(parsed.score) || 0));
                feedback = String(parsed.feedback || '').slice(0, 1000);
                matched = Array.isArray(parsed.matched_keywords) ? parsed.matched_keywords.slice(0, 20).map(String) : [];
                missing = Array.isArray(parsed.missing_keywords) ? parsed.missing_keywords.slice(0, 20).map(String) : [];
            } else {
                feedback = 'Grader returned an unparseable response; defaulting to mid-score.';
                score = 0.5;
            }
        } catch (judgeErr) {
            console.error('grade-answer judge error:', judgeErr);
            return res.status(502).json({ error: 'Grader unavailable', details: judgeErr.message });
        }

        // Map score -> FSRS rating: 1=Again, 2=Hard, 3=Good, 4=Easy.
        const ratingSuggested = score >= 0.9 ? 4 : score >= 0.7 ? 3 : score >= 0.4 ? 2 : 1;

        // Persist attempt (best-effort).
        try {
            await supabase.from('short_answer_attempts').insert({
                user_id: user.id,
                flashcard_id: flashcardId,
                user_answer: userAnswer,
                score,
                rating_suggested: ratingSuggested,
                feedback,
                matched_keywords: matched,
                missing_keywords: missing
            });
        } catch (saveErr) {
            // Table may not exist yet (pre-migration).
            if (saveErr.code !== '42P01' && !/does not exist/i.test(saveErr.message || '')) {
                console.warn('⚠️  short_answer_attempts insert failed:', saveErr.message);
            }
        }

        // Auto-feed the mistake journal when score < 0.5 (Phase 3 #9).
        if (score < 0.5) {
            try {
                await supabase.from('wrong_answers').insert({
                    user_id: user.id,
                    document_id: card.document_id,
                    source_kind: 'short_answer',
                    source_id: flashcardId,
                    question: card.front,
                    expected_answer: expected,
                    user_answer: userAnswer,
                    source_chunk_id: card.source_chunk_id,
                    details: { score, missing_keywords: missing }
                });
            } catch (journalErr) {
                if (journalErr.code !== '42P01' && !/does not exist/i.test(journalErr.message || '')) {
                    console.warn('⚠️  wrong_answers insert failed:', journalErr.message);
                }
            }
        }

        res.json({
            score: Number(score.toFixed(3)),
            rating_suggested: ratingSuggested,
            feedback,
            matched_keywords: matched,
            missing_keywords: missing
        });
    } catch (err) {
        console.error('POST /flashcards/:id/grade-answer error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /flashcards/stats
 * Lightweight summary: how many due now, how many studied today.
 */
router.get('/stats', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;

    try {
        const nowIso = new Date().toISOString();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const [{ count: dueNow }, { count: reviewedToday }, { count: totalCards }] = await Promise.all([
            supabase
                .from('flashcard_reviews')
                .select('flashcard_id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .lte('due_at', nowIso),
            supabase
                .from('flashcard_reviews')
                .select('flashcard_id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .gte('last_review', startOfDay.toISOString()),
            supabase
                .from('flashcards')
                .select('id', { count: 'exact', head: true })
        ]);

        res.json({
            due_now: dueNow || 0,
            reviewed_today: reviewedToday || 0,
            total_cards: totalCards || 0
        });
    } catch (err) {
        console.error('GET /flashcards/stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
