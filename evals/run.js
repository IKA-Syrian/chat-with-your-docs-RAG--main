#!/usr/bin/env node
/**
 * StudyAI eval harness — v1
 *
 * Reads every fixture under evals/fixtures, calls the running backend /chat
 * endpoint, scores keyword recall + source-count + forbidden-keyword hits,
 * and prints a PASS/FAIL summary.
 *
 * Run: `npm run eval`
 *
 * Required env:
 *   EVAL_AUTH_TOKEN   - a valid Supabase JWT (from browser localStorage).
 *
 * Optional env:
 *   EVAL_BASE_URL     - default http://localhost:3001/api
 *   EVAL_PROVIDER     - default unset (server picks default)
 *   EVAL_MODEL        - default unset (server picks default)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- args & config ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const arg = (name) => {
    const m = argv.find(a => a.startsWith(`${name}=`));
    return m ? m.split('=').slice(1).join('=') : null;
};

const filter = arg('--filter');
const jsonOutput = flag('--json');
const verbose = flag('--verbose') || flag('-v');

const BASE_URL = process.env.EVAL_BASE_URL || 'http://localhost:3001/api';
const TOKEN = process.env.EVAL_AUTH_TOKEN;
const PROVIDER = process.env.EVAL_PROVIDER || undefined;
const MODEL = process.env.EVAL_MODEL || undefined;

if (!TOKEN) {
    console.error('✗ EVAL_AUTH_TOKEN is required (export it before running).');
    process.exit(2);
}

// ---------- fixture discovery ----------
const fixturesDir = path.join(__dirname, 'fixtures');
const allFiles = fs.existsSync(fixturesDir)
    ? fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json'))
    : [];

if (allFiles.length === 0) {
    console.error(`✗ No fixtures found in ${fixturesDir}. Add at least one *.json file.`);
    process.exit(2);
}

const fixtures = allFiles
    .map(f => {
        try {
            const raw = fs.readFileSync(path.join(fixturesDir, f), 'utf8');
            return { file: f, ...JSON.parse(raw) };
        } catch (err) {
            console.error(`✗ Failed to parse ${f}: ${err.message}`);
            return null;
        }
    })
    .filter(Boolean)
    .filter(fx => !filter || (fx.id || fx.file).includes(filter));

if (fixtures.length === 0) {
    console.error(`✗ No fixtures matched filter ${JSON.stringify(filter)}.`);
    process.exit(2);
}

// ---------- runner ----------
async function runFixture(fx) {
    const started = Date.now();
    const body = {
        message: fx.question,
        document_id: fx.document_id,
        history: [],
        explain_mode: fx.explain_mode || 'default'
    };
    if (PROVIDER) body.provider = PROVIDER;
    if (MODEL) body.model = MODEL;

    let resp;
    let elapsed;
    try {
        const r = await fetch(`${BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(body)
        });
        elapsed = Date.now() - started;
        const text = await r.text();
        try { resp = JSON.parse(text); } catch { resp = { error: text }; }
        if (!r.ok) {
            return {
                fixture: fx,
                status: 'ERROR',
                error: resp?.error || `HTTP ${r.status}`,
                latency_ms: elapsed
            };
        }
    } catch (err) {
        return { fixture: fx, status: 'ERROR', error: err.message, latency_ms: Date.now() - started };
    }

    const answer = (resp.message || '').toLowerCase();
    const expectedKeywords = (fx.expected_keywords || []).map(s => s.toLowerCase());
    const forbiddenKeywords = (fx.forbidden_keywords || []).map(s => s.toLowerCase());

    const expectedHits = expectedKeywords.filter(k => answer.includes(k));
    const forbiddenHits = forbiddenKeywords.filter(k => answer.includes(k));
    const keywordRecall = expectedKeywords.length === 0 ? 1 : expectedHits.length / expectedKeywords.length;

    const sourceCount = Array.isArray(resp.sources) ? resp.sources.length : 0;
    const minSources = typeof fx.min_sources === 'number' ? fx.min_sources : 0;

    const passed =
        keywordRecall >= 1 &&
        forbiddenHits.length === 0 &&
        sourceCount >= minSources;

    return {
        fixture: fx,
        status: passed ? 'PASS' : 'FAIL',
        keyword_recall: Number(keywordRecall.toFixed(3)),
        expected_hits: expectedHits,
        missing_keywords: expectedKeywords.filter(k => !answer.includes(k)),
        forbidden_hits: forbiddenHits,
        source_count: sourceCount,
        min_sources: minSources,
        latency_ms: elapsed,
        provider: resp.provider,
        model: resp.model,
        usage: resp.usage || null,
        answer_preview: (resp.message || '').slice(0, 200)
    };
}

// ---------- main ----------
const results = [];
for (const fx of fixtures) {
    if (!jsonOutput) process.stdout.write(`▸ ${fx.id || fx.file} … `);
    const r = await runFixture(fx);
    results.push(r);
    if (!jsonOutput) {
        const tag = r.status === 'PASS' ? '✓ PASS' : r.status === 'FAIL' ? '✗ FAIL' : '! ERROR';
        console.log(`${tag} (${r.latency_ms ?? '?'}ms)`);
        if (r.status !== 'PASS' && r.status !== 'ERROR') {
            if (r.missing_keywords?.length) console.log(`    missing: ${r.missing_keywords.join(', ')}`);
            if (r.forbidden_hits?.length) console.log(`    forbidden hits: ${r.forbidden_hits.join(', ')}`);
            if (r.source_count < r.min_sources) console.log(`    sources: ${r.source_count} < required ${r.min_sources}`);
            if (verbose) console.log(`    answer: ${r.answer_preview}`);
        }
        if (r.status === 'ERROR') console.log(`    error: ${r.error}`);
    }
}

// ---------- summary ----------
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const errored = results.filter(r => r.status === 'ERROR').length;
const totalLatency = results.reduce((s, r) => s + (r.latency_ms || 0), 0);
const totalCost = results.reduce((s, r) => s + (r.usage?.cost_usd || 0), 0);

if (jsonOutput) {
    console.log(JSON.stringify({
        summary: {
            total: results.length,
            passed, failed, errored,
            total_latency_ms: totalLatency,
            total_cost_usd: Number(totalCost.toFixed(6))
        },
        results
    }, null, 2));
} else {
    console.log('');
    console.log(`──────────────────────────────────────`);
    console.log(`  ${passed} pass · ${failed} fail · ${errored} error    (${results.length} total)`);
    console.log(`  ${totalLatency} ms total · $${totalCost.toFixed(5)} estimated`);
    console.log(`──────────────────────────────────────`);
}

process.exit(failed + errored > 0 ? 1 : 0);
