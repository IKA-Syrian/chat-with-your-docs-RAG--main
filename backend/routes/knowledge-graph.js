/**
 * @swagger
 * tags:
 *   name: KnowledgeGraph
 *   description: Phase 4 #21 — per-document concept maps
 */

import { Router } from 'express';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import { validateUser } from './auth.js';
import enhancedAIService from '../lib/enhanced-ai-service.js';

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
    return { supabase: createUserClient(authToken), user, authToken };
}

/**
 * GET /api/documents/:id/knowledge-graph
 * Return existing graph or 404 — generation is explicit (POST).
 */
router.get('/:id/knowledge-graph', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase } = ctx;

    try {
        const { data, error } = await supabase
            .from('knowledge_graphs')
            .select('document_id, nodes, edges, node_count, edge_count, provider, model, generated_at')
            .eq('document_id', req.params.id)
            .maybeSingle();

        if (error) {
            // 42P01 = table missing → migration not applied yet.
            if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
                return res.status(503).json({ error: 'Knowledge graph not yet available — apply migration 010' });
            }
            return res.status(400).json({ error: error.message });
        }
        if (!data) return res.status(404).json({ error: 'No knowledge graph for this document yet — POST to /knowledge-graph to generate' });
        res.json(data);
    } catch (err) {
        console.error('GET /knowledge-graph error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/documents/:id/knowledge-graph
 * Body: { provider?, model?, force_regenerate?: boolean }
 *
 * Pulls the document's text (from document_content or sections), runs the
 * LLM extractor, normalizes the result, and upserts into knowledge_graphs.
 */
router.post('/:id/knowledge-graph', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;
    const { provider, model, force_regenerate } = req.body || {};
    const documentId = req.params.id;

    try {
        // Verify the document exists and the caller is the OWNER (not just a
        // shared editor) — generation goes through admin client below to bypass
        // RLS-on-INSERT, so we must enforce ownership at the controller layer.
        const { data: doc, error: docErr } = await supabase
            .from('documents')
            .select('id, name, created_by')
            .eq('id', documentId)
            .single();
        if (docErr || !doc) return res.status(404).json({ error: 'Document not found' });
        if (doc.created_by !== user.id) {
            return res.status(403).json({ error: 'Only the document owner can generate the knowledge graph' });
        }

        // Skip regeneration if a graph exists and the caller didn't ask for force.
        if (!force_regenerate) {
            const { data: existing } = await supabase
                .from('knowledge_graphs')
                .select('document_id, nodes, edges, generated_at')
                .eq('document_id', documentId)
                .maybeSingle();
            if (existing && existing.nodes?.length > 0) {
                return res.json({ ...existing, cached: true });
            }
        }

        // Pull the document text (prefer document_content, fall back to concatenated sections).
        let text = '';
        try {
            const { data: contentRow } = await supabase
                .from('document_content')
                .select('content')
                .eq('document_id', documentId)
                .maybeSingle();
            if (contentRow?.content) {
                // Stricter base64 sniff: long enough that prose unlikely to match
                // by accident, AND ends with optional `=` padding.
                const c = contentRow.content;
                const looksLikeBase64 =
                    typeof c === 'string' &&
                    c.length >= 200 &&
                    c.length % 4 === 0 &&
                    /^[A-Za-z0-9+/]+={0,2}$/.test(c);
                if (looksLikeBase64) {
                    try {
                        const decoded = Buffer.from(c, 'base64').toString('utf-8');
                        // Only accept the decode if it produces mostly printable text.
                        const printable = decoded.replace(/[^\x20-\x7E\n\r\t]/g, '').length / decoded.length;
                        text = printable > 0.95 ? decoded : c;
                    } catch { text = c; }
                } else {
                    text = c;
                }
            }
        } catch { /* document_content table may not exist */ }

        if (!text || text.length < 100) {
            const { data: sections } = await supabase
                .from('document_sections')
                .select('content, chunk_level')
                .eq('document_id', documentId)
                .order('chunk_index', { ascending: true })
                .limit(40);
            // Prefer parents (level 0) — they're larger & lossless.
            const parents = (sections || []).filter(s => s.chunk_level === 0).map(s => s.content);
            text = (parents.length > 0 ? parents : (sections || []).map(s => s.content)).join('\n\n');
        }

        if (!text || text.length < 100) {
            return res.status(422).json({ error: 'Document has no usable text — process it first.' });
        }

        // Generate.
        const graph = await enhancedAIService.generateKnowledgeGraph(text, {
            provider,
            model
        });

        if (!graph?.nodes?.length) {
            return res.status(502).json({ error: 'AI returned no nodes — try a different model or shorter document.' });
        }

        // Upsert via admin (the RLS policies cover ownership but the GENERATED
        // columns require the row to be visible to the caller post-insert).
        const admin = supabaseAdmin();
        const { error: upsertErr } = await admin
            .from('knowledge_graphs')
            .upsert({
                document_id: documentId,
                nodes: graph.nodes,
                edges: graph.edges,
                provider: provider || null,
                model: model || null,
                generated_at: new Date().toISOString()
            }, { onConflict: 'document_id' });

        if (upsertErr) {
            if (upsertErr.code === '42P01' || /does not exist/i.test(upsertErr.message || '')) {
                return res.status(503).json({ error: 'knowledge_graphs table missing — apply migration 010' });
            }
            return res.status(500).json({ error: 'Failed to save graph', details: upsertErr.message });
        }

        res.json({
            document_id: documentId,
            nodes: graph.nodes,
            edges: graph.edges,
            node_count: graph.nodes.length,
            edge_count: graph.edges.length,
            provider: provider || null,
            model: model || null,
            generated_at: new Date().toISOString(),
            cached: false
        });
    } catch (err) {
        console.error('POST /knowledge-graph error:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

/**
 * GET /api/documents/:id/knowledge-graph/weak-nodes
 * Cross-references the graph with mistake-journal + flashcard_reviews to
 * surface concepts the user is struggling with. Best-effort: returns a
 * list of node ids ordered by struggle score, plus the tally per source.
 */
router.get('/:id/knowledge-graph/weak-nodes', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;
    const documentId = req.params.id;

    try {
        const { data: graph } = await supabase
            .from('knowledge_graphs')
            .select('nodes')
            .eq('document_id', documentId)
            .maybeSingle();
        if (!graph?.nodes?.length) return res.json({ weak_nodes: [] });

        // Gather signals: unresolved wrong_answers + flashcard_reviews with low stability.
        const [{ data: mistakes }, { data: reviews }] = await Promise.all([
            supabase
                .from('wrong_answers')
                .select('question')
                .eq('user_id', user.id)
                .eq('document_id', documentId)
                .eq('resolved', false)
                .limit(200),
            supabase
                .from('flashcard_reviews')
                .select('flashcard_id, stability, lapses, flashcards!inner(document_id, front, back)')
                .eq('user_id', user.id)
                .lt('stability', 5)
                .limit(200)
        ]);

        // Score each node by how often its label/keywords appear in mistakes/cards.
        const nodes = graph.nodes;
        const haystacks = [
            ...(mistakes || []).map(m => (m.question || '').toLowerCase()),
            ...(reviews || [])
                .filter(r => r.flashcards?.document_id === documentId)
                .map(r => `${r.flashcards.front || ''} ${r.flashcards.back || ''}`.toLowerCase())
        ];

        const scored = nodes.map(n => {
            const needle = (n.label || '').toLowerCase();
            if (!needle) return { id: n.id, label: n.label, struggle_score: 0, hits: 0 };
            const hits = haystacks.reduce((c, h) => c + (h.includes(needle) ? 1 : 0), 0);
            return { id: n.id, label: n.label, struggle_score: hits * (n.importance || 1), hits };
        }).filter(x => x.struggle_score > 0).sort((a, b) => b.struggle_score - a.struggle_score);

        res.json({ weak_nodes: scored.slice(0, 15) });
    } catch (err) {
        console.error('GET /weak-nodes error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
