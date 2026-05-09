-- 2026-05-06-000-auth-stub.sql
-- Compatibility shim for environments without the Supabase auth schema
-- (bare Postgres, self-hosted without GoTrue, etc.).
--
-- On real Supabase this is a complete no-op:
--   * auth schema already exists -> CREATE SCHEMA IF NOT EXISTS skips
--   * auth.users already exists  -> CREATE TABLE IF NOT EXISTS skips
--   * auth.uid()/role()/jwt() already exist -> pg_proc IF guard skips
--
-- On bare Postgres it provides the minimum surface later migrations need:
--   * FK target:  auth.users(id UUID PK)
--   * RLS calls:  auth.uid() / auth.role() / auth.jwt()  (return NULL)
--
-- Backend uses the service-role client server-side which bypasses RLS,
-- so NULL-returning auth.uid() does not break runtime queries.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;

-- Stub auth.users with the columns later migrations actually FK against.
-- Real Supabase auth.users has many more columns; CREATE TABLE IF NOT EXISTS
-- means we never touch the real one.
CREATE TABLE IF NOT EXISTS auth.users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT,
    raw_user_meta_data  JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Functions: only create if absent so we never clobber Supabase's real ones.
DO $stub$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'auth' AND p.proname = 'uid'
    ) THEN
        CREATE FUNCTION auth.uid() RETURNS UUID
        LANGUAGE SQL STABLE
        AS $body$
            SELECT NULLIF(
                current_setting('request.jwt.claim.sub', true),
                ''
            )::UUID
        $body$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'auth' AND p.proname = 'role'
    ) THEN
        CREATE FUNCTION auth.role() RETURNS TEXT
        LANGUAGE SQL STABLE
        AS $body$
            SELECT NULLIF(
                current_setting('request.jwt.claim.role', true),
                ''
            )
        $body$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'auth' AND p.proname = 'jwt'
    ) THEN
        CREATE FUNCTION auth.jwt() RETURNS JSONB
        LANGUAGE SQL STABLE
        AS $body$
            SELECT NULLIF(
                current_setting('request.jwt.claims', true),
                ''
            )::JSONB
        $body$;
    END IF;
END
$stub$;

-- Supabase ships three pre-defined roles. Later migrations GRANT to
-- `authenticated`; on bare Postgres that role doesn't exist. Create it (and
-- the siblings, for completeness) only if missing — guard makes this a no-op
-- on real Supabase.
DO $roles$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
    END IF;
END
$roles$;
