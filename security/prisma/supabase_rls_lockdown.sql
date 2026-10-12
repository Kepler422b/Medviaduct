-- =============================================================================
-- MediVault / Medviaduct — Supabase PostgREST & Database RLS Lockdown Policy
-- Member 3 (Security Workstream) — Architecture & Database Policy Guardrail
-- =============================================================================
--
-- CRITICAL HONESTY AND ARCHITECTURAL CLARITY:
-- 1. Server Connection Privileges:
--    The Node.js Express backend and Prisma ORM connect to PostgreSQL via direct
--    TCP connection pool (DATABASE_URL) using the database owner ('postgres' or 'service_role').
--    Prisma queries run with elevated database superuser/owner privileges.
--    THEREFORE, END-USER ROW LEVEL SECURITY (RLS) POLICIES NEVER AUTOMATICALLY
--    PROTECT PRIVILEGED PRISMA QUERIES EXECUTED ON THE BACKEND SERVER.
--    Centralized application authorization ('authorizePatientAccess') is the
--    primary, mandatory authorization boundary.
--
-- 2. Browser Direct-Access Lockdown:
--    If Supabase is used in the infrastructure, Supabase exposes an auto-generated
--    REST API (PostgREST) directly to web browsers using public anon/authenticated keys.
--    If tables are not locked down, a browser client could bypass all application
--    authorization checks, consent grants, emergency checks, and no-store headers
--    by querying Supabase directly (e.g. supabase.from('patient_profiles').select('*')).
--
-- This script ensures:
-- 1. Direct browser access to ALL sensitive tables is completely revoked and blocked.
-- 2. RLS is forced on every table.
-- 3. Anonymous and authenticated PostgREST roles are revoked all permissions.
-- =============================================================================

-- Enable and FORCE Row Level Security on all security and identity tables
ALTER TABLE IF EXISTS user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patient_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS clinician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clinician_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS consents FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS qr_tokens FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_grants FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS emergency_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emergency_access_grants FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_events FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Revoke all direct browser access permissions from PostgREST roles & add deny policies
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    -- Revoke from anon role (unauthenticated browser requests)
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

        EXECUTE 'DROP POLICY IF EXISTS deny_anon_all ON user_accounts';
        EXECUTE 'CREATE POLICY deny_anon_all ON user_accounts FOR ALL TO anon USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_anon_all ON patient_profiles';
        EXECUTE 'CREATE POLICY deny_anon_all ON patient_profiles FOR ALL TO anon USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_anon_all ON consents';
        EXECUTE 'CREATE POLICY deny_anon_all ON consents FOR ALL TO anon USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_anon_all ON qr_tokens';
        EXECUTE 'CREATE POLICY deny_anon_all ON qr_tokens FOR ALL TO anon USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_anon_all ON access_grants';
        EXECUTE 'CREATE POLICY deny_anon_all ON access_grants FOR ALL TO anon USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_anon_all ON emergency_access_grants';
        EXECUTE 'CREATE POLICY deny_anon_all ON emergency_access_grants FOR ALL TO anon USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_anon_all ON audit_events';
        EXECUTE 'CREATE POLICY deny_anon_all ON audit_events FOR ALL TO anon USING (false)';
    END IF;

    -- Revoke from authenticated role (browser requests holding Supabase user JWTs)
    -- All access must traverse the Medviaduct Security API, not PostgREST!
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;

        EXECUTE 'DROP POLICY IF EXISTS deny_auth_all ON user_accounts';
        EXECUTE 'CREATE POLICY deny_auth_all ON user_accounts FOR ALL TO authenticated USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_auth_all ON patient_profiles';
        EXECUTE 'CREATE POLICY deny_auth_all ON patient_profiles FOR ALL TO authenticated USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_auth_all ON consents';
        EXECUTE 'CREATE POLICY deny_auth_all ON consents FOR ALL TO authenticated USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_auth_all ON qr_tokens';
        EXECUTE 'CREATE POLICY deny_auth_all ON qr_tokens FOR ALL TO authenticated USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_auth_all ON access_grants';
        EXECUTE 'CREATE POLICY deny_auth_all ON access_grants FOR ALL TO authenticated USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_auth_all ON emergency_access_grants';
        EXECUTE 'CREATE POLICY deny_auth_all ON emergency_access_grants FOR ALL TO authenticated USING (false)';

        EXECUTE 'DROP POLICY IF EXISTS deny_auth_all ON audit_events';
        EXECUTE 'CREATE POLICY deny_auth_all ON audit_events FOR ALL TO authenticated USING (false)';
    END IF;
END $$;

-- Notice to operators
COMMENT ON TABLE consents IS 'Protected table: Direct PostgREST access blocked. Must access via Medviaduct Express API on port 3001.';
COMMENT ON TABLE audit_events IS 'Immutable table: Trigger-enforced append-only. Direct PostgREST access blocked.';
