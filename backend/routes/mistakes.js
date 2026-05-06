/**
 * @swagger
 * tags:
 *   name: Mistakes
 *   description: Phase 3 #9 — unified mistake journal (quiz + flashcard + short-answer wrongs)
 */

import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import { validateUser } from './auth.js';
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
 * GET /api/mistakes
 * Query: document_id (optional), include_resolved (default false), limit (default 50)
 * Returns the unified mistake list joined with document & chunk excerpts.
 */
router.get('/', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;

    const documentId = req.query.document_id || null;
    const includeResolved = String(req.query.include_resolved || 'false').toLowerCase() === 'true';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    try {
        let query = supabase
            .from('wrong_answers')
            .select(`
                id, user_id, document_id, source_kind, source_id,
                question, expected_answer, user_answer,
                source_chunk_id, ai_explanation, details,
                resolved, resolved_at, created_at,
                documents:document_id (name),
                document_sections:source_chunk_id (content)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (documentId) query = query.eq('document_id', documentId);
        if (!includeResolved) query = query.eq('resolved', false);

        const { data: rows, error } = await query;
        if (error) {
            // 42P01 = table missing (pre-migration). Return empty result.
            if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
                return res.json({ total: 0, unresolved: 0, mistakes: [] });
            }
            return res.status(400).json({ error: error.message });
        }

        const mistakes = (rows || []).map(r => ({
            id: r.id,
            source_kind: r.source_kind,
            source_id: r.source_id,
            question: r.question,
            user_answer: r.user_answer,
            expected_answer: r.expected_answer,
            source_chunk_excerpt: r.document_sections?.content
                ? r.document_sections.content.slice(0, 280) + (r.document_sections.content.length > 280 ? '…' : '')
                : null,
            document_id: r.document_id,
            document_name: r.documents?.name || null,
            ai_explanation: r.ai_explanation,
            details: r.details || {},
            resolved: r.resolved,
            created_at: r.created_at
        }));

        // Single extra count query for the unresolved badge.
        let unresolved = 0;
        try {
            const { count } = await supabase
                .from('wrong_answers')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('resolved', false);
            unresolved = count || 0;
        } catch { /* ignore */ }

        res.json({
            total: mistakes.length,
            unresolved,
            mistakes
        });
    } catch (err) {
        console.error('GET /mistakes error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/mistakes/:id
 * Body: { resolved: boolean }
 */
router.patch('/:id', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;

    const id = req.params.id;
    const resolved = !!req.body?.resolved;
    try {
        const { error } = await supabase
            .from('wrong_answers')
            .update({ resolved, resolved_at: resolved ? new Date().toISOString() : null })
            .eq('id', id)
            .eq('user_id', user.id);
        if (error) return res.status(400).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        console.error('PATCH /mistakes/:id error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/mistakes/:id/explain
 * Lazily generates an AI explanation for a mistake and caches it.
 */
router.post('/:id/explain', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;

    const id = req.params.id;
    try {
        const { data: row, error: rowErr } = await supabase
            .from('wrong_answers')
            .select('id, question, expected_answer, user_answer, ai_explanation, document_sections:source_chunk_id (content)')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();
        if (rowErr || !row) return res.status(404).json({ error: 'Mistake not found' });

        if (row.ai_explanation) {
            return res.json({ explanation: row.ai_explanation });
        }

        const provider = aiProviderManager.getProvider();
        const messages = [
            {
                role: 'system',
                content: 'You explain why an answer is wrong, in 2–4 sentences. Be encouraging, specific, and reference the relevant content from the source excerpt when possible.'
            },
            {
                role: 'user',
                content: `Question: ${row.question}\n\nStudent's answer: ${row.user_answer || '(blank)'}\n\nCorrect answer: ${row.expected_answer || '(unknown)'}\n\nSource excerpt: ${row.document_sections?.content?.slice(0, 1500) || '(none)'}\n\nExplain why the student's answer was wrong and what they should remember.`
            }
        ];

        const aiResp = await provider.chat(messages, { temperature: 0.4, max_tokens: 300 });
        const explanation = (aiResp.content || '').trim();

        // Cache it.
        try {
            await supabase
                .from('wrong_answers')
                .update({ ai_explanation: explanation })
                .eq('id', id)
                .eq('user_id', user.id);
        } catch { /* not fatal */ }

        res.json({ explanation });
    } catch (err) {
        console.error('POST /mistakes/:id/explain error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
