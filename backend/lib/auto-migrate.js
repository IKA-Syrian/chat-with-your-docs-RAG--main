/**
 * Auto-migrator. Runs all SQL files under backend/migrations/ that haven't
 * been applied yet, in filename order. Tracked in a single
 * `_studyai_migrations` table (additive — only ever appends rows).
 *
 * Activated only when DATABASE_URL is configured. Without it, the function
 * prints a loud banner with the exact list of migration files the operator
 * needs to paste into Supabase Studio.
 *
 * Notes:
 *  - Uses the `pg` package directly (already a dependency).
 *  - Each migration runs in a transaction; failure rolls back and skips
 *    later migrations (so partial state can't accumulate silently).
 *  - Applied filenames are stored verbatim — never reapplied.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function listMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) return [];
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort(); // filenames are date-prefixed -> lexicographic == chronological
}

function printManualBanner(reason, files) {
    const bar = '═'.repeat(78);
    console.log('\n' + bar);
    console.log('  AUTO-MIGRATE: SKIPPED');
    console.log('  Reason: ' + reason);
    console.log('  ');
    console.log('  Apply these files manually in Supabase Studio → SQL Editor,');
    console.log('  in this order:');
    for (const f of files) console.log('    • ' + f);
    console.log('  ');
    console.log('  Or set DATABASE_URL in backend/.env and restart to auto-apply.');
    console.log('  Format: postgres://postgres:<password>@<host>:5432/postgres');
    console.log('  (find it in Supabase Dashboard → Project Settings → Database)');
    console.log(bar + '\n');
}

export async function runAutoMigrations() {
    const files = listMigrationFiles();
    if (files.length === 0) {
        console.log('🗂️  Auto-migrate: no migration files found');
        return { ran: 0, skipped: 0, mode: 'noop' };
    }

    const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (!url) {
        printManualBanner('DATABASE_URL not configured', files);
        return { ran: 0, skipped: files.length, mode: 'manual' };
    }

    let pg;
    try {
        pg = await import('pg');
    } catch {
        printManualBanner('`pg` package not installed', files);
        return { ran: 0, skipped: files.length, mode: 'manual' };
    }

    const { Client } = pg.default || pg;

    // Try the URL with the SSL setting hinted by the connection string itself
    // (sslmode=disable / require / no-verify). If that fails AND the error is
    // SSL-specific, retry the OPPOSITE setting once. Covers:
    //   - Cloud Supabase (requires SSL, self-signed CA → ssl: rejectUnauthorized:false)
    //   - Self-hosted Postgres without SSL configured (must be ssl: false)
    //   - Local dev DBs reached over a non-TLS socket
    const sslHint = /[?&]sslmode=disable\b/i.test(url) ? false : { rejectUnauthorized: false };

    async function tryConnect(sslConfig) {
        const c = new Client({ connectionString: url, ssl: sslConfig });
        await c.connect();
        return c;
    }

    let client;
    try {
        client = await tryConnect(sslHint);
    } catch (err) {
        const msg = err.message || '';
        // Server doesn't support SSL → retry without; or server requires SSL → retry with.
        const sslMismatch = /does not support SSL|SSL\s+(?:not\s+)?supported|SSL\s+required|sslmode|TLS/i.test(msg);
        if (sslMismatch) {
            console.log(`🗂️  Auto-migrate: SSL ${sslHint ? 'enabled' : 'disabled'} mismatch (${msg.slice(0, 80)}); retrying with the opposite`);
            try {
                client = await tryConnect(sslHint ? false : { rejectUnauthorized: false });
            } catch (err2) {
                printManualBanner(`Could not connect to DATABASE_URL (${err2.code || err2.message})`, files);
                return { ran: 0, skipped: files.length, mode: 'connect_failed' };
            }
        } else {
            printManualBanner(`Could not connect to DATABASE_URL (${err.code || err.message})`, files);
            return { ran: 0, skipped: files.length, mode: 'connect_failed' };
        }
    }

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS _studyai_migrations (
                filename   TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        const { rows } = await client.query('SELECT filename FROM _studyai_migrations');
        const applied = new Set(rows.map(r => r.filename));
        const pending = files.filter(f => !applied.has(f));

        if (pending.length === 0) {
            console.log(`🗂️  Auto-migrate: all ${files.length} migrations already applied`);
            return { ran: 0, skipped: 0, mode: 'up_to_date' };
        }

        console.log(`🗂️  Auto-migrate: ${pending.length} pending of ${files.length} total`);
        let ran = 0;
        for (const f of pending) {
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(
                    'INSERT INTO _studyai_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
                    [f]
                );
                await client.query('COMMIT');
                console.log(`   ✅ ${f}`);
                ran++;
            } catch (err) {
                await client.query('ROLLBACK').catch(() => {});
                console.error(`   ❌ ${f}: ${err.message}`);
                console.error('   Halting auto-migrate — fix the failing migration and restart.');
                return { ran, skipped: pending.length - ran, mode: 'failed', failedFile: f, error: err.message };
            }
        }
        console.log(`🗂️  Auto-migrate: applied ${ran} migration${ran === 1 ? '' : 's'}`);
        return { ran, skipped: 0, mode: 'success' };
    } finally {
        await client.end().catch(() => {});
    }
}

export default { runAutoMigrations };
