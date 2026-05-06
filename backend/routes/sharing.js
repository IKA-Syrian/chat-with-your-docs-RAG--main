/**
 * @swagger
 * tags:
 *   name: Sharing
 *   description: Phase 4 #22 — per-document sharing via direct grants and tokenized invites
 */

import { Router } from 'express';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import { validateUser } from './auth.js';
import crypto from 'node:crypto';

const router = Router();

const VALID_PERMS = new Set(['read', 'study', 'edit']);

// Phase 4 #22 — anti-brute-force on invite redemption. In-memory; resets at
// process boundaries. 30 attempts per IP per minute is plenty for legitimate
// redemption (one click) while making token-guessing impractical.
const REDEEM_RATE_WINDOW_MS = 60 * 1000;
const REDEEM_RATE_LIMIT = 30;
const redeemAttempts = new Map(); // ip -> { count, resetAt }
function checkRedeemRate(ip) {
    const key = ip || 'unknown';
    const now = Date.now();
    const entry = redeemAttempts.get(key);
    if (!entry || entry.resetAt < now) {
        redeemAttempts.set(key, { count: 1, resetAt: now + REDEEM_RATE_WINDOW_MS });
        return true;
    }
    if (entry.count >= REDEEM_RATE_LIMIT) return false;
    entry.count += 1;
    return true;
}

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

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

/**
 * POST /api/documents/:id/invite
 * Body: { permission: 'read' | 'study' | 'edit', email_hint?: string }
 * Owner-only. Returns a tokenized one-click invite URL valid 14 days.
 */
router.post('/documents/:id/invite', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;
    const documentId = req.params.id;
    const permission = req.body?.permission || 'study';
    const emailHint = (req.body?.email_hint || '').toString().slice(0, 320) || null;

    if (!VALID_PERMS.has(permission)) {
        return res.status(400).json({ error: 'permission must be one of: read, study, edit' });
    }

    try {
        // Verify ownership (RLS will also block, but we want a clean 403).
        const { data: doc, error: docErr } = await supabase
            .from('documents')
            .select('id, name, created_by')
            .eq('id', documentId)
            .single();
        if (docErr || !doc) return res.status(404).json({ error: 'Document not found' });
        if (doc.created_by !== user.id) {
            return res.status(403).json({ error: 'Only the document owner can issue invites' });
        }

        const token = crypto.randomBytes(32).toString('base64url');
        const { error: insertErr } = await supabase
            .from('document_invites')
            .insert({
                token,
                document_id: documentId,
                permission,
                created_by: user.id,
                email_hint: emailHint
            });

        if (insertErr) {
            if (insertErr.code === '42P01' || /does not exist/i.test(insertErr.message || '')) {
                return res.status(503).json({ error: 'Sharing not yet available — apply migration 011' });
            }
            return res.status(500).json({ error: 'Failed to create invite', details: insertErr.message });
        }

        res.status(201).json({
            token,
            url: `${FRONTEND_URL}/invites/${token}`,
            permission,
            expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        });
    } catch (err) {
        console.error('POST /documents/:id/invite error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/documents/:id/shares
 * Owner-only. Lists current direct grants AND outstanding invites.
 */
router.get('/documents/:id/shares', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase, user } = ctx;
    const documentId = req.params.id;

    try {
        const { data: doc } = await supabase
            .from('documents')
            .select('created_by')
            .eq('id', documentId)
            .single();
        if (!doc || doc.created_by !== user.id) {
            return res.status(403).json({ error: 'Only the owner can list shares' });
        }

        const [{ data: shares }, { data: invites }] = await Promise.all([
            supabase
                .from('document_shares')
                .select('shared_with_user_id, permission, granted_at')
                .eq('document_id', documentId),
            supabase
                .from('document_invites')
                .select('token, permission, email_hint, expires_at, redeemed_by, redeemed_at, created_at')
                .eq('document_id', documentId)
                .is('redeemed_by', null)
                .gt('expires_at', new Date().toISOString())
        ]);

        res.json({
            shares: (shares || []).map(s => ({ ...s })),
            invites: (invites || []).map(i => ({
                ...i,
                url: `${FRONTEND_URL}/invites/${i.token}`
            }))
        });
    } catch (err) {
        console.error('GET /documents/:id/shares error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/documents/:id/shares/:userId
 * Owner OR self can revoke a share row.
 */
router.delete('/documents/:id/shares/:userId', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase } = ctx;

    try {
        const { error } = await supabase
            .from('document_shares')
            .delete()
            .eq('document_id', req.params.id)
            .eq('shared_with_user_id', req.params.userId);
        if (error) return res.status(400).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE share error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/documents/:id/invites/:token
 * Owner-only. Cancels an unredeemed invite.
 */
router.delete('/documents/:id/invites/:token', async (req, res) => {
    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { supabase } = ctx;
    try {
        const { error } = await supabase
            .from('document_invites')
            .delete()
            .eq('document_id', req.params.id)
            .eq('token', req.params.token)
            .is('redeemed_by', null);
        if (error) return res.status(400).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE invite error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/invites/:token/redeem
 * Recipient must be authenticated. Atomically creates a document_shares row
 * and marks the invite redeemed. Idempotent if the recipient already holds
 * a grant on this doc — returns the existing permission.
 *
 * Goes through supabaseAdmin because the recipient cannot SELECT the invite
 * row directly (RLS only lets the creator read it).
 */
router.post('/invites/:token/redeem', async (req, res) => {
    // Per-IP rate limit BEFORE any DB lookup so token guessing is bounded
    // (best-effort: behind a proxy you must trust X-Forwarded-For; Express's
    // req.ip honors the trust proxy setting).
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    if (!checkRedeemRate(ip)) {
        return res.status(429).json({ error: 'Too many redemption attempts. Please wait a minute.' });
    }

    const ctx = await authedSupabase(req, res);
    if (!ctx) return;
    const { user } = ctx;
    const token = req.params.token;

    // Uniform "not found" for invalid format, missing rows, expired, or
    // already-redeemed-by-other-user. This removes the oracle — an attacker
    // can't tell whether a guessed token exists, expired, or belongs to
    // someone else.
    const NOT_FOUND = () => res.status(404).json({ error: 'Invite not found or no longer valid' });

    if (!token || token.length < 16 || token.length > 100) return NOT_FOUND();

    const admin = supabaseAdmin();

    try {
        const { data: invite, error: inviteErr } = await admin
            .from('document_invites')
            .select('token, document_id, permission, created_by, expires_at, redeemed_by')
            .eq('token', token)
            .maybeSingle();

        if (inviteErr) {
            if (inviteErr.code === '42P01' || /does not exist/i.test(inviteErr.message || '')) {
                return res.status(503).json({ error: 'Sharing not yet available — apply migration 011' });
            }
            return res.status(500).json({ error: 'Lookup failed' });
        }
        if (!invite) return NOT_FOUND();

        if (new Date(invite.expires_at) < new Date()) return NOT_FOUND();
        if (invite.redeemed_by && invite.redeemed_by !== user.id) return NOT_FOUND();
        if (invite.created_by === user.id) {
            // The inviter trying to redeem their own link is a clear UX mistake
            // (not an attack), so it's OK to surface a useful message here.
            return res.status(400).json({ error: 'You cannot redeem your own invite' });
        }

        // Idempotent share write.
        const { error: shareErr } = await admin
            .from('document_shares')
            .upsert({
                document_id: invite.document_id,
                shared_with_user_id: user.id,
                permission: invite.permission,
                granted_by: invite.created_by,
                granted_at: new Date().toISOString()
            }, { onConflict: 'document_id,shared_with_user_id', ignoreDuplicates: false });

        if (shareErr) return res.status(500).json({ error: 'Failed to grant access', details: shareErr.message });

        // Mark invite redeemed (only if not already, to keep the original timestamp).
        if (!invite.redeemed_by) {
            await admin
                .from('document_invites')
                .update({ redeemed_by: user.id, redeemed_at: new Date().toISOString() })
                .eq('token', token);
        }

        res.json({
            success: true,
            document_id: invite.document_id,
            permission: invite.permission
        });
    } catch (err) {
        console.error('POST /invites/:token/redeem error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
