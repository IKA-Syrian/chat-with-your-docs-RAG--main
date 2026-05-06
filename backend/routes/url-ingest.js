/**
 * @swagger
 * tags:
 *   name: URLs
 *   description: Ingest content from web URLs (general pages and YouTube videos)
 */

import { Router } from 'express';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import { randomUUID } from 'crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { validateUser } from './auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const YT_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'];
const MAX_FETCH_BYTES = 5 * 1024 * 1024;          // 5 MB cap
const FETCH_TIMEOUT_MS = 15_000;
const REQUEST_UA = 'Mozilla/5.0 (compatible; StudyAI-bot/1.0)';

function parseUrl(raw) {
    try {
        const u = new URL(raw);
        return u;
    } catch {
        return null;
    }
}

function isPrivateHostString(hostname) {
    const lc = hostname.toLowerCase();
    if (lc === 'localhost' || lc.endsWith('.localhost')) return true;
    if (lc.endsWith('.internal') || lc.endsWith('.local')) return true;
    return false;
}

/**
 * True if the IP literal points to private / loopback / link-local space.
 * Covers IPv4 (incl. decimal-encoded forms like 2130706433) and IPv6 (incl. v4-mapped).
 */
function isPrivateIp(ip) {
    const fam = net.isIP(ip);
    if (fam === 0) return false;
    if (fam === 4) {
        const parts = ip.split('.').map(n => parseInt(n, 10));
        if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true;
        const [a, b] = parts;
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 0) return true;
        if (a === 169 && b === 254) return true;     // link-local
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT
        if (a === 198 && (b === 18 || b === 19)) return true;
        if (a >= 224) return true;                    // multicast / reserved
        return false;
    }
    // IPv6
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // v4-mapped: ::ffff:127.0.0.1 etc.
    const mapped = lower.match(/^::ffff:([0-9.]+)$/);
    if (mapped && net.isIPv4(mapped[1])) return isPrivateIp(mapped[1]);
    return false;
}

/**
 * Resolve hostname to all addresses and reject if any are private.
 * (Defense against DNS rebinding: we only TRUST the hostname for the URL we
 * pass to fetch, but if DNS rebinding flips after this check, we still risk
 * one fetch landing internally — Node's `fetch` doesn't allow pinning the IP.
 * For v1 the hostname-resolves-publicly check is the best we get without
 * shipping a custom Agent.)
 */
async function isHostAllowed(hostname) {
    if (isPrivateHostString(hostname)) return false;
    // Direct IP literals: validate immediately.
    if (net.isIP(hostname)) return !isPrivateIp(hostname);
    try {
        const records = await dns.lookup(hostname, { all: true });
        if (!Array.isArray(records) || records.length === 0) return false;
        return records.every(r => !isPrivateIp(r.address));
    } catch {
        return false;
    }
}

async function fetchWithLimit(url, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            ...opts,
            signal: ctrl.signal,
            headers: { 'User-Agent': REQUEST_UA, 'Accept': 'text/html,*/*;q=0.8', ...(opts.headers || {}) }
        });
        if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

        const reader = res.body?.getReader?.();
        if (!reader) {
            const text = await res.text();
            return { text: text.slice(0, MAX_FETCH_BYTES), contentType: res.headers.get('content-type') || '' };
        }

        const chunks = [];
        let total = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            total += value.length;
            if (total > MAX_FETCH_BYTES) throw new Error('Response exceeded 5MB cap');
            chunks.push(value);
        }
        const buf = Buffer.concat(chunks.map(c => Buffer.from(c)));
        return { text: buf.toString('utf8'), contentType: res.headers.get('content-type') || '' };
    } finally {
        clearTimeout(timer);
    }
}

function htmlToText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(br|\/p|\/h[1-6]|\/div|\/li)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function extractTitle(html) {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!m) return null;
    return htmlToText(m[1]).slice(0, 200) || null;
}

function youtubeVideoId(u) {
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    const shortsMatch = u.pathname.match(/^\/shorts\/([\w-]{6,})/);
    if (shortsMatch) return shortsMatch[1];
    return null;
}

/**
 * Best-effort YouTube transcript fetch via the public timed-text endpoint.
 * Brittle (depends on YouTube's HTML), but adds zero npm deps. Returns null
 * if no captions are available — caller should surface a clean error.
 */
/**
 * Walk a JSON snippet starting at the opening bracket to find its balanced
 * close, ignoring brackets inside strings. Returns the substring INCLUDING
 * the outer brackets, or null if unbalanced.
 */
function extractBalancedArray(source, startIdx) {
    if (source[startIdx] !== '[') return null;
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let i = startIdx; i < source.length; i++) {
        const ch = source[i];
        if (inStr) {
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '[') depth++;
        else if (ch === ']') { depth--; if (depth === 0) return source.slice(startIdx, i + 1); }
    }
    return null;
}

async function fetchYouTubeTranscript(videoId) {
    const watch = `https://www.youtube.com/watch?v=${videoId}`;
    const { text: html } = await fetchWithLimit(watch);

    // Find the `"captionTracks":` key, then extract the balanced array following it.
    const keyIdx = html.indexOf('"captionTracks":');
    if (keyIdx < 0) return { transcript: null, title: extractTitle(html) };
    const arrStart = html.indexOf('[', keyIdx);
    if (arrStart < 0) return { transcript: null, title: extractTitle(html) };
    const arrSlice = extractBalancedArray(html, arrStart);
    if (!arrSlice) return { transcript: null, title: extractTitle(html) };

    let tracks;
    try {
        tracks = JSON.parse(arrSlice.replace(/\\u0026/g, '&'));
    } catch {
        return { transcript: null, title: extractTitle(html) };
    }
    if (!Array.isArray(tracks) || tracks.length === 0) return { transcript: null, title: extractTitle(html) };

    // Prefer English; fall back to the first track.
    const track = tracks.find(t => /en/i.test(t.languageCode || '')) || tracks[0];
    const trackUrl = (track.baseUrl || '').replace(/\\u0026/g, '&');
    if (!trackUrl) return { transcript: null, title: extractTitle(html) };

    const { text: xml } = await fetchWithLimit(trackUrl);
    // The endpoint returns XML like <text start="..." dur="...">caption</text>
    const segments = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
        .map(m2 => htmlToText(m2[1]).replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    const transcript = segments.join('\n');

    const titleMatch = html.match(/"title":"([^"\\]+(?:\\.[^"\\]*)*)"/);
    const title = titleMatch ? titleMatch[1].replace(/\\(.)/g, '$1').slice(0, 200) : extractTitle(html);

    return { transcript: transcript || null, title };
}

// ---------------------------------------------------------------------------
// POST /api/documents/from-url
// Body: { url: string, title?: string }
// Creates a `documents` row populated with the extracted text and queues the
// rest of the pipeline (chunking + embeddings) via process.js.
// ---------------------------------------------------------------------------
router.post('/from-url', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        if (!authToken) return res.status(401).json({ error: 'No authorization token provided' });

        const { user, error: userError } = await validateUser(authToken);
        if (userError || !user) return res.status(401).json({ error: 'User not authenticated' });

        const { url: rawUrl, title: titleOverride } = req.body || {};
        if (!rawUrl || typeof rawUrl !== 'string') {
            return res.status(400).json({ error: 'Missing url' });
        }

        const u = parseUrl(rawUrl.trim());
        if (!u || !['http:', 'https:'].includes(u.protocol)) {
            return res.status(400).json({ error: 'Invalid URL — must be http or https' });
        }
        if (!(await isHostAllowed(u.hostname))) {
            return res.status(400).json({ error: 'URL host is not allowed (private, link-local, or unresolvable)' });
        }

        // 1) Extract text.
        const isYouTube = YT_HOSTS.includes(u.hostname.toLowerCase());
        let extractedText = '';
        let derivedTitle = null;
        let sourceKind = 'web';

        if (isYouTube) {
            sourceKind = 'youtube';
            const videoId = youtubeVideoId(u);
            if (!videoId) return res.status(400).json({ error: 'Could not parse YouTube video id' });
            const { transcript, title } = await fetchYouTubeTranscript(videoId);
            if (!transcript) {
                return res.status(422).json({
                    error: 'No captions available for this video. Try another video or paste the transcript manually.'
                });
            }
            extractedText = transcript;
            derivedTitle = title || `YouTube video ${videoId}`;
        } else {
            const { text: html, contentType } = await fetchWithLimit(u.toString());
            if (contentType && !/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
                return res.status(415).json({ error: `Unsupported content-type: ${contentType}` });
            }
            extractedText = htmlToText(html);
            derivedTitle = extractTitle(html);
        }

        if (!extractedText || extractedText.length < 50) {
            return res.status(422).json({ error: 'Extracted text was too short to be useful' });
        }

        // 2) Insert documents row.
        const admin = supabaseAdmin();
        const documentId = randomUUID();
        const documentName = (titleOverride || derivedTitle || u.hostname).slice(0, 255);

        // Try with the migration-006 columns first; on "column does not exist"
        // retry with the legacy shape so this route works pre-migration.
        const baseRow = {
            id: documentId,
            name: documentName,
            created_by: user.id,
            file_type: sourceKind === 'youtube' ? 'application/x-youtube' : 'text/html',
            file_extension: sourceKind === 'youtube' ? 'youtube' : 'html',
            status: 'uploading',
            processed: false
        };
        const enrichedRow = {
            ...baseRow,
            source_kind: sourceKind,
            source_url: u.toString()
        };
        let { error: docErr } = await admin.from('documents').insert(enrichedRow);
        if (docErr && /column.*does not exist|source_kind|source_url/i.test(docErr.message || '')) {
            ({ error: docErr } = await admin.from('documents').insert(baseRow));
        }
        if (docErr) {
            console.error('❌ from-url: document insert failed:', docErr);
            return res.status(500).json({ error: 'Failed to create document', details: docErr.message });
        }

        // 3) Stash the extracted text in document_content (best-effort) so the
        //    process.js pipeline has something to chunk.
        try {
            await admin
                .from('document_content')
                .insert({ document_id: documentId, content: extractedText });
        } catch (err) {
            // Some deployments may not have this table; not fatal.
            console.warn('⚠️  document_content insert skipped:', err.message);
        }

        // 4) Kick off processing (fire-and-forget). The /api/process endpoint
        //    handles chunking + embeddings.
        const processUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/process`;
        fetch(processUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ document_id: documentId, source_text: extractedText })
        }).catch(err => console.warn('⚠️  process kick-off failed:', err.message));

        res.json({
            id: documentId,
            name: documentName,
            source: sourceKind,
            url: u.toString(),
            text_length: extractedText.length,
            preview: extractedText.slice(0, 300)
        });
    } catch (err) {
        console.error('from-url error:', err);
        const status = err?.name === 'AbortError' ? 504 : 500;
        res.status(status).json({ error: 'Failed to ingest URL', details: err.message });
    }
});

export default router;
