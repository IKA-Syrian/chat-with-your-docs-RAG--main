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
// Pretend to be a real Chrome on Windows. YouTube serves a different
// (often captionless) page to anything that looks like a bot, so the
// "compatible; StudyAI-bot" UA we used previously was being filtered.
const REQUEST_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

// Bypasses YouTube's EU cookie-consent gate that otherwise serves a
// captionless landing page until the user accepts cookies.
const YT_CONSENT_COOKIE = 'CONSENT=YES+cb.20240101-00-p0.en+FX+000; SOCS=CAI';

/**
 * Forgiving URL parser. Strips whitespace, surrounding quotes (common when
 * users copy-paste from chat apps), and auto-prepends https:// when no
 * protocol is present (so `youtube.com/watch?v=...` works).
 */
function parseUrl(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let cleaned = raw.trim()
        .replace(/^["'<\s]+|["'>\s]+$/g, '')   // strip surrounding quotes / brackets / whitespace
        .replace(/\s+/g, '');                   // strip any remaining whitespace
    if (!cleaned) return null;

    // Auto-prepend https:// if no protocol. Reject obviously-non-URL strings.
    if (!/^https?:\/\//i.test(cleaned)) {
        // Don't prepend if it looks like a local path or has no dot.
        if (cleaned.startsWith('//')) cleaned = 'https:' + cleaned;
        else if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(cleaned)) cleaned = 'https://' + cleaned;
        else return null;
    }
    try {
        return new URL(cleaned);
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
            headers: {
                'User-Agent': REQUEST_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                ...(opts.headers || {})
            }
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

/**
 * Walk forward from index `i` looking for a balanced `{...}` JSON object.
 * String-aware: braces inside string literals don't count.
 */
function extractBalancedObject(source, startIdx) {
    if (source[startIdx] !== '{') return null;
    let depth = 0, inStr = false, escape = false;
    for (let i = startIdx; i < source.length; i++) {
        const ch = source[i];
        if (inStr) {
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) return source.slice(startIdx, i + 1); }
    }
    return null;
}

/**
 * Pull the captionTracks array out of the YouTube watch page HTML.
 * Tries multiple paths because YouTube's HTML changes regularly:
 *   1. Direct `"captionTracks":[...]` substring (fastest path).
 *   2. Inside the `ytInitialPlayerResponse` JSON blob, traversed
 *      via .captions.playerCaptionsTracklistRenderer.captionTracks.
 *   3. Inside the older `ytplayer.config.args.player_response` JSON.
 * Returns an array (possibly empty) of track objects.
 */
function extractCaptionTracks(html) {
    // Path 1: literal key
    {
        const keyIdx = html.indexOf('"captionTracks":');
        if (keyIdx >= 0) {
            const arrStart = html.indexOf('[', keyIdx);
            if (arrStart >= 0) {
                const arrSlice = extractBalancedArray(html, arrStart);
                if (arrSlice) {
                    try {
                        const tracks = JSON.parse(arrSlice.replace(/\\u0026/g, '&'));
                        if (Array.isArray(tracks) && tracks.length > 0) return tracks;
                    } catch { /* fall through */ }
                }
            }
        }
    }

    // Path 2: ytInitialPlayerResponse = {...};
    for (const marker of ['var ytInitialPlayerResponse = ', 'ytInitialPlayerResponse = ']) {
        const idx = html.indexOf(marker);
        if (idx < 0) continue;
        const objStart = html.indexOf('{', idx);
        if (objStart < 0) continue;
        const objSlice = extractBalancedObject(html, objStart);
        if (!objSlice) continue;
        try {
            const obj = JSON.parse(objSlice);
            const tracks = obj?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (Array.isArray(tracks) && tracks.length > 0) return tracks;
        } catch { /* fall through */ }
    }

    // Path 3: legacy ytplayer.config
    const cfg = html.indexOf('ytplayer.config');
    if (cfg >= 0) {
        const prKey = html.indexOf('"player_response":"', cfg);
        if (prKey >= 0) {
            const valStart = prKey + '"player_response":"'.length;
            const valEnd = html.indexOf('"', valStart);
            if (valEnd > valStart) {
                const escaped = html.slice(valStart, valEnd);
                try {
                    // player_response is a JSON-stringified JSON string
                    const inner = JSON.parse('"' + escaped + '"');
                    const obj = JSON.parse(inner);
                    const tracks = obj?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                    if (Array.isArray(tracks) && tracks.length > 0) return tracks;
                } catch { /* fall through */ }
            }
        }
    }

    return [];
}

/**
 * Primary path: the `youtube-transcript` npm package. It maintains workarounds
 * for YouTube's evolving anti-scraping (PoToken, signed-URL changes, etc.)
 * which our manual scraper can't keep up with. If the package is missing or
 * fails, fall through to the manual scraper below.
 */
async function fetchYouTubeTranscriptViaPackage(videoId) {
    let mod;
    try {
        mod = await import('youtube-transcript');
    } catch {
        return null; // package not installed
    }
    const YT = mod.YoutubeTranscript || mod.default?.YoutubeTranscript;
    if (!YT) return null;

    // Try English first; fall back to whatever's available.
    let segments = null;
    try {
        segments = await YT.fetchTranscript(videoId, { lang: 'en' });
    } catch {
        try {
            segments = await YT.fetchTranscript(videoId);
        } catch (e) {
            console.warn(`[youtube-transcript] both attempts failed: ${e.message}`);
            return null;
        }
    }
    if (!Array.isArray(segments) || segments.length === 0) return null;

    const text = segments
        .map(s => (s.text || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
    return text || null;
}

async function fetchYouTubeTranscript(videoId) {
    // 1) Try the maintained npm package first.
    try {
        const pkgTranscript = await fetchYouTubeTranscriptViaPackage(videoId);
        if (pkgTranscript) {
            console.log(`[fetchYouTubeTranscript] npm package returned ${pkgTranscript.length} chars for ${videoId}`);
            // Best-effort title from the watch page (not critical).
            let title = null;
            try {
                const { text: html } = await fetchWithLimit(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
                    headers: { Cookie: YT_CONSENT_COOKIE }
                });
                const m = html.match(/"title":"([^"\\]+(?:\\.[^"\\]*)*)"/);
                title = m ? m[1].replace(/\\(.)/g, '$1').slice(0, 200) : extractTitle(html);
            } catch { /* don't fail the whole call over a missing title */ }
            return { transcript: pkgTranscript, title: title || `YouTube video ${videoId}`, reason: 'ok_pkg' };
        }
    } catch (pkgErr) {
        console.warn(`[fetchYouTubeTranscript] package path threw: ${pkgErr.message}`);
    }

    // 2) Manual scraper fallback. Increasingly broken by YouTube but kept as
    //    a backstop in case the package version we have stops working.
    const watch = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
    let html = '';
    try {
        ({ text: html } = await fetchWithLimit(watch, {
            headers: { Cookie: YT_CONSENT_COOKIE }
        }));
    } catch (fetchErr) {
        console.error('[fetchYouTubeTranscript] watch page fetch failed:', fetchErr.message);
        throw fetchErr;
    }

    // Bail with a useful diagnostic if YouTube served a captcha / consent / "video unavailable" page.
    if (/uxe=23983171|consent\.youtube\.com|This video isn't available|gV9rAaY9OY/i.test(html)) {
        console.warn('[fetchYouTubeTranscript] YouTube served a non-watch page (consent/captcha/unavailable)');
    }

    const tracks = extractCaptionTracks(html);
    console.log(`[fetchYouTubeTranscript] ${tracks.length} caption track(s) found for ${videoId}`);

    if (tracks.length === 0) {
        return { transcript: null, title: extractTitle(html), reason: 'no_tracks_found' };
    }

    // Prefer English (manual then auto-generated); fall back to the first track.
    const score = (t) => {
        const lc = (t.languageCode || '').toLowerCase();
        let s = 0;
        if (lc === 'en' || lc.startsWith('en-')) s += 100;
        if (t.kind !== 'asr') s += 10; // prefer manual over auto-generated
        return s;
    };
    const track = [...tracks].sort((a, b) => score(b) - score(a))[0];
    const trackUrl = (track?.baseUrl || '').replace(/\\u0026/g, '&');
    if (!trackUrl) return { transcript: null, title: extractTitle(html), reason: 'no_baseUrl' };

    let xml = '';
    try {
        ({ text: xml } = await fetchWithLimit(trackUrl, {
            headers: { Cookie: YT_CONSENT_COOKIE }
        }));
    } catch (xmlErr) {
        console.error('[fetchYouTubeTranscript] timedtext fetch failed:', xmlErr.message);
        return { transcript: null, title: extractTitle(html), reason: 'timedtext_fetch_failed' };
    }

    const segments = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
        .map(m2 => htmlToText(m2[1]).replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    const transcript = segments.join('\n');

    const titleMatch = html.match(/"title":"([^"\\]+(?:\\.[^"\\]*)*)"/);
    const title = titleMatch ? titleMatch[1].replace(/\\(.)/g, '$1').slice(0, 200) : extractTitle(html);

    return {
        transcript: transcript || null,
        title,
        reason: transcript ? 'ok' : 'empty_transcript'
    };
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
            console.warn('[from-url] rejected: missing url field');
            return res.status(400).json({ error: 'Missing url' });
        }

        const u = parseUrl(rawUrl);
        if (!u) {
            console.warn(`[from-url] rejected: parseUrl returned null for input: ${JSON.stringify(rawUrl).slice(0, 200)}`);
            return res.status(400).json({
                error: 'Could not parse that URL. Make sure it starts with https:// (we add it for you if missing) and contains a valid domain like youtube.com or example.com/article.'
            });
        }
        if (!['http:', 'https:'].includes(u.protocol)) {
            console.warn(`[from-url] rejected: protocol "${u.protocol}" not http/https`);
            return res.status(400).json({ error: `Unsupported protocol "${u.protocol}". Only http and https are allowed.` });
        }
        if (!(await isHostAllowed(u.hostname))) {
            console.warn(`[from-url] rejected: host "${u.hostname}" failed isHostAllowed (private/link-local/unresolvable)`);
            return res.status(400).json({
                error: `Host "${u.hostname}" couldn't be resolved or points to a private/local network.`
            });
        }

        console.log(`[from-url] accepted: ${u.toString()}`);

        // 1) Extract text.
        const isYouTube = YT_HOSTS.includes(u.hostname.toLowerCase());
        let extractedText = '';
        let derivedTitle = null;
        let sourceKind = 'web';

        if (isYouTube) {
            sourceKind = 'youtube';
            const videoId = youtubeVideoId(u);
            if (!videoId) {
                console.warn(`[from-url] YouTube: could not parse video id from ${u.toString()}`);
                return res.status(400).json({
                    error: `Couldn't find a video id in that YouTube URL. Use a "watch?v=..." or "youtu.be/..." link.`
                });
            }
            console.log(`[from-url] YouTube videoId: ${videoId}`);
            try {
                const { transcript, title, reason } = await fetchYouTubeTranscript(videoId);
                if (!transcript) {
                    console.warn(`[from-url] YouTube: no transcript for ${videoId} (reason=${reason})`);
                    const reasonMsg = ({
                        no_tracks_found: 'YouTube did not return any caption tracks for this video. Either the video has no captions, or YouTube is blocking the scrape from this server.',
                        no_baseUrl: 'Caption track was found but had no baseUrl — YouTube returned an unexpected shape.',
                        timedtext_fetch_failed: 'Caption track URL was found but the timedtext request failed.',
                        empty_transcript: 'The caption track was empty.'
                    })[reason] || 'No transcript could be extracted.';
                    return res.status(422).json({
                        error: reasonMsg + ' Try another video, or upload the file directly.'
                    });
                }
                extractedText = transcript;
                derivedTitle = title || `YouTube video ${videoId}`;
                console.log(`[from-url] YouTube transcript: ${transcript.length} chars, title="${derivedTitle}"`);
            } catch (ytErr) {
                console.error(`[from-url] YouTube fetch threw:`, ytErr.message);
                return res.status(502).json({
                    error: `Could not fetch the YouTube transcript (${ytErr.message}). YouTube sometimes blocks automated requests; try again in a minute.`
                });
            }
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
