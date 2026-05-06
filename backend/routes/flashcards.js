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

        let cardQuery = supabase
            .from('flashcards')
            .select('id, document_id, front, back, card_index, source_chunk_id, created_at')
            .order('created_at', { ascending: true })
            .limit(limit * 4); // overfetch — we'll filter to due ones

        if (documentId) cardQuery = cardQuery.eq('document_id', documentId);

        const { data: cards, error: cardErr } = await cardQuery;
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
            .select('id, document_id')
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

        res.json({ review: saved });
    } catch (err) {
        console.error('POST /flashcards/:id/review error:', err);
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
