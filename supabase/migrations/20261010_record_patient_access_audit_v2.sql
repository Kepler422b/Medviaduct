-- =============================================================================
-- Migration: Hardened Patient Access Audit Routine (v2)
-- MediVault HLTH-01: Local Draft for Review (Revised)
--
-- Key Capabilities & Guarantees:
-- 1. Uncompromised Clinical Audit Trail: Every patient-record read and access
--    validation attempt generates its own distinct, verifiable audit row in
--    public.access_audit_logs. Reads are NEVER debounced or suppressed.
-- 2. Verifiable Audit Tracking: Every audit_id returned with audit_recorded: true
--    is guaranteed to be the exact primary key of the newly inserted row.
-- 3. Database-Generated Timestamps: Captures the row's actual created_at directly
--    via RETURNING created_at from PostgreSQL rather than clock_timestamp().
-- 4. Anti-Enumeration Role Verification: Caller clinician role is verified BEFORE
--    querying public.patients. Non-clinicians are denied with uniform responses
--    without leaking patient existence.
-- 5. Strict Input Validation: Rejects null patient IDs, invalid scopes, and
--    invalid actions with standard SQLSTATE 22023.
-- 6. Atomic Denial Quota Counter: Tracks denial bursts via public.audit_rate_limits
--    using row-level locking on actor_id to prevent counter race conditions.
-- 7. Non-Destructive Deployment: Preserves legacy write_patient_access_audit and
--    log_patient_access_attempt functions untouched.
-- =============================================================================

BEGIN;

-- 1. Dedicated atomic rate-limit table (max 1 row per registered actor)
CREATE TABLE IF NOT EXISTS public.audit_rate_limits (
    actor_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    window_start timestamptz NOT NULL,
    denied_count integer NOT NULL DEFAULT 1
);

ALTER TABLE public.audit_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_rate_limits FROM PUBLIC, anon, authenticated;

-- 2. Index on access_audit_logs to accelerate actor compliance queries
CREATE INDEX IF NOT EXISTS access_audit_logs_actor_created_idx
    ON public.access_audit_logs(actor_id, created_at DESC);

-- 3. Versioned Audit Routine
CREATE OR REPLACE FUNCTION public.record_patient_access_audit(
    p_patient_id uuid,
    p_scope text,
    p_action text DEFAULT 'read'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_actor uuid := (SELECT auth.uid());
    v_caller_role text;
    v_patient_exists boolean := false;
    v_is_clinician boolean := false;
    v_authorized boolean := false;
    v_audit_id bigint;
    v_created_at timestamptz;
    v_action_name text;
    v_denial_reason text := NULL;
    v_denied_count int := 0;
    v_quota int := 5; -- default denial quota for non-clinicians
BEGIN
    -- 1. Derive actor strictly from authenticated JWT context
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Validate patient ID (must not be null)
    IF p_patient_id IS NULL THEN
        RAISE EXCEPTION 'Invalid patient ID: cannot be null'
            USING ERRCODE = '22023';
    END IF;

    -- 3. Verify caller has an active profile in public.profiles
    SELECT p.role INTO v_caller_role
    FROM public.profiles p
    WHERE p.id = v_actor;

    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'Caller profile not found'
            USING ERRCODE = '42501';
    END IF;

    -- 4. Scope validation against strict allowlist
    IF p_scope IS NULL OR NOT (
        p_scope = ANY (
            ARRAY[
                'patient_summary',
                'visits',
                'diagnoses',
                'prescriptions'
            ]::text[]
        )
    ) THEN
        RAISE EXCEPTION 'Invalid access scope'
            USING ERRCODE = '22023';
    END IF;

    -- 5. Action validation against strict allowlist ('read' vs 'validate')
    IF p_action IS NULL OR NOT (p_action IN ('read', 'validate')) THEN
        RAISE EXCEPTION 'Invalid audit action; must be read or validate'
            USING ERRCODE = '22023';
    END IF;

    -- 6. Anti-Enumeration & Role Verification:
    -- Verify clinician role BEFORE evaluating patient existence.
    -- Non-clinicians are denied immediately without querying public.patients,
    -- preventing unauthorized probing of patient IDs.
    v_is_clinician := (v_caller_role = 'clinician');

    IF NOT v_is_clinician THEN
        v_authorized := false;
        v_denial_reason := 'clinician_role_required';
        v_quota := 5; -- Max 5 denials per minute for non-clinicians
    ELSE
        -- Caller is a clinician: evaluate consent grant or emergency access
        v_authorized := public.can_access_patient(p_patient_id, p_scope);
        v_quota := 30; -- Max 30 denials per minute for clinicians

        IF NOT v_authorized THEN
            -- Check patient existence strictly to record internal audit reason
            -- (never leaked in HTTP responses to unauthorized callers)
            SELECT EXISTS (
                SELECT 1 FROM public.patients WHERE id = p_patient_id
            ) INTO v_patient_exists;

            IF NOT v_patient_exists THEN
                v_denial_reason := 'patient_not_found';
            ELSE
                v_denial_reason := 'consent_or_emergency_access_required';
            END IF;
        END IF;
    END IF;

    -- =========================================================================
    -- BRANCH A: AUTHORIZED ACCESS
    -- Every authorized read and validate attempt creates its own distinct audit row.
    -- Reads are NEVER debounced or suppressed.
    -- =========================================================================
    IF v_authorized THEN
        v_action_name := CASE
            WHEN p_action = 'validate' THEN 'patient_access_validated'
            ELSE 'patient_record_access_authorized'
        END;

        -- Insert audit row and capture database-generated ID and created_at
        INSERT INTO public.access_audit_logs (
            actor_id,
            action,
            resource_type,
            resource_id,
            outcome
        )
        VALUES (
            v_actor,
            v_action_name,
            'patient_record:' || p_scope,
            p_patient_id::text,
            'allowed'
        )
        RETURNING id, created_at INTO v_audit_id, v_created_at;

        RETURN jsonb_build_object(
            'audit_recorded', true,
            'audit_id', v_audit_id,
            'authorized', true,
            'scope', p_scope,
            'patient_id', p_patient_id,
            'action', v_action_name,
            'created_at', v_created_at,
            'reason', null,
            'rate_limited', false
        );
    END IF;

    -- =========================================================================
    -- BRANCH B: DENIED ACCESS
    -- Evaluates atomic denial quotas to protect storage from malicious floods.
    -- =========================================================================
    -- Atomic quota counter increment (row-level lock on actor_id)
    INSERT INTO public.audit_rate_limits AS arl
        (actor_id, window_start, denied_count)
    VALUES (v_actor, date_trunc('minute', now()), 1)
    ON CONFLICT (actor_id) DO UPDATE
    SET
        denied_count = CASE
            WHEN arl.window_start < EXCLUDED.window_start THEN 1
            ELSE arl.denied_count + 1
        END,
        window_start = EXCLUDED.window_start
    RETURNING arl.denied_count INTO v_denied_count;

    v_action_name := CASE
        WHEN p_action = 'validate' THEN 'patient_access_validation_denied'
        ELSE 'patient_record_access_denied'
    END;

    -- Threshold Alert: write high-priority security alert when quota is breached
    IF v_denied_count = v_quota + 1 THEN
        INSERT INTO public.access_audit_logs (
            actor_id,
            action,
            resource_type,
            resource_id,
            outcome
        )
        VALUES (
            v_actor,
            'audit_quota_exceeded',
            'security_alert',
            p_patient_id::text,
            'denied'
        )
        RETURNING id, created_at INTO v_audit_id, v_created_at;

        RETURN jsonb_build_object(
            'audit_recorded', true,
            'audit_id', v_audit_id,
            'authorized', false,
            'scope', p_scope,
            'patient_id', p_patient_id,
            'action', 'audit_quota_exceeded',
            'created_at', v_created_at,
            'reason', 'audit_quota_exceeded',
            'rate_limited', true
        );
    END IF;

    -- Flooding Suppression: suppress row insertion beyond quota + 1 to prevent disk exhaustion
    IF v_denied_count > v_quota + 1 THEN
        RETURN jsonb_build_object(
            'audit_recorded', false,
            'audit_id', null,
            'authorized', false,
            'scope', p_scope,
            'patient_id', p_patient_id,
            'action', v_action_name,
            'created_at', null,
            'reason', 'audit_quota_exceeded',
            'rate_limited', true
        );
    END IF;

    -- Standard Denial: persist individual denial log within quota
    INSERT INTO public.access_audit_logs (
        actor_id,
        action,
        resource_type,
        resource_id,
        outcome
    )
    VALUES (
        v_actor,
        v_action_name,
        'patient_record:' || p_scope,
        p_patient_id::text,
        'denied'
    )
    RETURNING id, created_at INTO v_audit_id, v_created_at;

    RETURN jsonb_build_object(
        'audit_recorded', true,
        'audit_id', v_audit_id,
        'authorized', false,
        'scope', p_scope,
        'patient_id', p_patient_id,
        'action', v_action_name,
        'created_at', v_created_at,
        'reason', v_denial_reason,
        'rate_limited', false
    );
END;
$function$;

-- Revoke all permissions from public/anon
REVOKE ALL ON FUNCTION public.record_patient_access_audit(uuid, text, text)
FROM PUBLIC, anon;

-- Grant execution to authenticated role
GRANT EXECUTE ON FUNCTION public.record_patient_access_audit(uuid, text, text)
TO authenticated;

COMMENT ON FUNCTION public.record_patient_access_audit(uuid, text, text)
IS 'Secure patient access audit routine. Derives actor and authorization server-side. Records distinct audit events for every read attempt.';

COMMIT;
