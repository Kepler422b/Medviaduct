-- =============================================================================
-- Migration: Zero-Trust Access Grants, QR Tokens, Consents, and Audit
-- MediVault / Medviaduct Production Security Architecture
--
-- Non-destructive deployment:
-- Uses CREATE TABLE IF NOT EXISTS and preserves all existing tables and data.
-- Supports dual-naming (Prisma camelCase and Supabase snake_case) via generated columns.
-- =============================================================================

BEGIN;

-- 1. CONSENTS TABLE
CREATE TABLE IF NOT EXISTS public.consents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patientId" uuid NOT NULL,
    "clinicianId" uuid NOT NULL,
    scopes text[] NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "expiresAt" timestamptz NOT NULL,
    "revokedAt" timestamptz,
    "createdByUserId" uuid NOT NULL,
    -- snake_case aliases for Supabase
    patient_id uuid GENERATED ALWAYS AS ("patientId") STORED,
    clinician_id uuid GENERATED ALWAYS AS ("clinicianId") STORED,
    created_at timestamptz GENERATED ALWAYS AS ("createdAt") STORED,
    expires_at timestamptz GENERATED ALWAYS AS ("expiresAt") STORED,
    revoked_at timestamptz GENERATED ALWAYS AS ("revokedAt") STORED,
    created_by_user_id uuid GENERATED ALWAYS AS ("createdByUserId") STORED
);

CREATE INDEX IF NOT EXISTS idx_consents_patient_status ON public.consents("patientId", status);
CREATE INDEX IF NOT EXISTS idx_consents_clinician ON public.consents("clinicianId");
CREATE INDEX IF NOT EXISTS idx_consents_expires_at ON public.consents("expiresAt");

-- 2. QR TOKENS TABLE (Single-use, hash only)
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "consentId" uuid NOT NULL REFERENCES public.consents(id) ON DELETE CASCADE,
    "tokenHash" text NOT NULL UNIQUE,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "expiresAt" timestamptz NOT NULL,
    "consumedAt" timestamptz,
    "revokedAt" timestamptz,
    -- snake_case aliases
    consent_id uuid GENERATED ALWAYS AS ("consentId") STORED,
    token_hash text GENERATED ALWAYS AS ("tokenHash") STORED,
    created_at timestamptz GENERATED ALWAYS AS ("createdAt") STORED,
    expires_at timestamptz GENERATED ALWAYS AS ("expiresAt") STORED,
    consumed_at timestamptz GENERATED ALWAYS AS ("consumedAt") STORED,
    revoked_at timestamptz GENERATED ALWAYS AS ("revokedAt") STORED
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_consent ON public.qr_tokens("consentId");
CREATE INDEX IF NOT EXISTS idx_qr_tokens_hash ON public.qr_tokens("tokenHash");

-- 3. ACCESS GRANTS TABLE
CREATE TABLE IF NOT EXISTS public.access_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "consentId" uuid NOT NULL REFERENCES public.consents(id) ON DELETE CASCADE,
    "patientId" uuid NOT NULL,
    "clinicianId" uuid NOT NULL,
    scopes text[] NOT NULL,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "expiresAt" timestamptz NOT NULL,
    "revokedAt" timestamptz,
    -- snake_case aliases
    consent_id uuid GENERATED ALWAYS AS ("consentId") STORED,
    patient_id uuid GENERATED ALWAYS AS ("patientId") STORED,
    clinician_id uuid GENERATED ALWAYS AS ("clinicianId") STORED,
    created_at timestamptz GENERATED ALWAYS AS ("createdAt") STORED,
    expires_at timestamptz GENERATED ALWAYS AS ("expiresAt") STORED,
    revoked_at timestamptz GENERATED ALWAYS AS ("revokedAt") STORED
);

CREATE INDEX IF NOT EXISTS idx_access_grants_clinician_patient ON public.access_grants("clinicianId", "patientId");
CREATE INDEX IF NOT EXISTS idx_access_grants_expires ON public.access_grants("expiresAt");

-- 4. EMERGENCY ACCESS GRANTS (Break-Glass)
CREATE TABLE IF NOT EXISTS public.emergency_access_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "patientId" uuid NOT NULL,
    "clinicianId" uuid NOT NULL,
    "reasonCode" text NOT NULL,
    "reasonText" text,
    justification text NOT NULL,
    scope text,
    scopes text[] NOT NULL DEFAULT ARRAY['emergency:read', 'timeline:read']::text[],
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "expiresAt" timestamptz NOT NULL,
    "revokedAt" timestamptz,
    "createdByUserId" uuid NOT NULL,
    "requestId" text,
    -- snake_case aliases
    patient_id uuid GENERATED ALWAYS AS ("patientId") STORED,
    clinician_id uuid GENERATED ALWAYS AS ("clinicianId") STORED,
    reason_code text GENERATED ALWAYS AS ("reasonCode") STORED,
    created_at timestamptz GENERATED ALWAYS AS ("createdAt") STORED,
    expires_at timestamptz GENERATED ALWAYS AS ("expiresAt") STORED,
    revoked_at timestamptz GENERATED ALWAYS AS ("revokedAt") STORED,
    created_by_user_id uuid GENERATED ALWAYS AS ("createdByUserId") STORED,
    request_id text GENERATED ALWAYS AS ("requestId") STORED
);

CREATE INDEX IF NOT EXISTS idx_emergency_grants_clinician_patient ON public.emergency_access_grants("clinicianId", "patientId");
CREATE INDEX IF NOT EXISTS idx_emergency_grants_expires ON public.emergency_access_grants("expiresAt");

-- 5. AUDIT EVENTS TABLE (Append-Only Tamper-Evident)
CREATE TABLE IF NOT EXISTS public.audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp timestamptz NOT NULL DEFAULT now(),
    "actorUserId" uuid,
    "actorRole" text NOT NULL,
    action text NOT NULL,
    outcome text NOT NULL CHECK (outcome IN ('ALLOWED', 'DENIED')),
    "internalReasonCode" text,
    "safeResourceRefs" jsonb DEFAULT '{}'::jsonb,
    "requestId" text,
    -- snake_case aliases
    actor_user_id uuid GENERATED ALWAYS AS ("actorUserId") STORED,
    actor_role text GENERATED ALWAYS AS ("actorRole") STORED,
    internal_reason_code text GENERATED ALWAYS AS ("internalReasonCode") STORED,
    safe_resource_refs jsonb GENERATED ALWAYS AS ("safeResourceRefs") STORED,
    request_id text GENERATED ALWAYS AS ("requestId") STORED
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON public.audit_events("actorUserId", timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action_outcome ON public.audit_events(action, outcome);

-- 6. TAMPER-EVIDENT TRIGGER: Enforce strictly append-only integrity on audit_events
CREATE OR REPLACE FUNCTION public.audit_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit events are strictly append-only and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update_delete ON public.audit_events;
CREATE TRIGGER audit_events_no_update_delete
BEFORE UPDATE OR DELETE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.audit_events_immutable();

-- 7. ENABLE ROW-LEVEL SECURITY
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 8. GRANT VALIDATION RPC HELPER
CREATE OR REPLACE FUNCTION public.verify_access_grant(
    p_grant_id uuid,
    p_patient_id uuid,
    p_clinician_id uuid,
    p_scope text DEFAULT 'timeline:read'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now timestamptz := now();
    v_grant record;
    v_emergency_grant record;
    v_consent record;
BEGIN
    -- Check regular access grants first
    SELECT id, "consentId", "patientId", "clinicianId", scopes, "expiresAt", "revokedAt"
    INTO v_grant
    FROM public.access_grants
    WHERE id = p_grant_id;

    IF v_grant.id IS NOT NULL THEN
        -- Check patient match
        IF v_grant."patientId" != p_patient_id THEN
            RETURN jsonb_build_object('valid', false, 'reason', 'grant_patient_mismatch');
        END IF;

        -- Check clinician match
        IF v_grant."clinicianId" != p_clinician_id THEN
            RETURN jsonb_build_object('valid', false, 'reason', 'grant_clinician_mismatch');
        END IF;

        -- Check revocation
        IF v_grant."revokedAt" IS NOT NULL THEN
            RETURN jsonb_build_object('valid', false, 'reason', 'grant_revoked');
        END IF;

        -- Check expiration
        IF v_grant."expiresAt" <= v_now THEN
            RETURN jsonb_build_object('valid', false, 'reason', 'grant_expired');
        END IF;

        -- Check underlying consent
        SELECT id, status, "expiresAt", "revokedAt"
        INTO v_consent
        FROM public.consents
        WHERE id = v_grant."consentId";

        IF v_consent.id IS NULL OR v_consent.status != 'active' OR v_consent."revokedAt" IS NOT NULL OR v_consent."expiresAt" <= v_now THEN
            RETURN jsonb_build_object('valid', false, 'reason', 'underlying_consent_invalid');
        END IF;

        RETURN jsonb_build_object(
            'valid', true,
            'grantType', 'CONSENT_GRANT',
            'grantId', v_grant.id,
            'expiresAt', v_grant."expiresAt"
        );
    END IF;

    -- Check emergency break-glass grants
    SELECT id, "patientId", "clinicianId", scopes, "expiresAt", "revokedAt", "reasonCode"
    INTO v_emergency_grant
    FROM public.emergency_access_grants
    WHERE id = p_grant_id;

    IF v_emergency_grant.id IS NOT NULL THEN
        IF v_emergency_grant."patientId" != p_patient_id THEN
            RETURN jsonb_build_object('valid', false, 'reason', 'emergency_grant_patient_mismatch');
        END IF;

        IF v_emergency_grant."clinicianId" != p_clinician_id THEN
            RETURN jsonb_build_object('valid', false, 'reason', 'emergency_grant_clinician_mismatch');
        END IF;

        IF v_emergency_grant."revokedAt" IS NOT NULL THEN
            RETURN jsonb_build_object('valid', false, 'reason', 'emergency_grant_revoked');
        END IF;

        IF v_emergency_grant."expiresAt" <= v_now THEN
            RETURN jsonb_build_object('valid', false, 'reason', 'emergency_grant_expired');
        END IF;

        RETURN jsonb_build_object(
            'valid', true,
            'grantType', 'EMERGENCY_OVERRIDE',
            'grantId', v_emergency_grant.id,
            'expiresAt', v_emergency_grant."expiresAt"
        );
    END IF;

    RETURN jsonb_build_object('valid', false, 'reason', 'grant_not_found');
END;
$$;

COMMIT;
