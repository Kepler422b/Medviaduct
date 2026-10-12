import { z } from 'zod';
import { ForbiddenError, ValidationError } from '../middleware/errorHandler.js';
import { IdentityRepository } from '../contracts/interfaces.js';
import { AuditService } from '../audit/service.js';
import { UserRole } from '../contracts/types.js';

/**
 * ============================================================================
 * MediVault / Medviaduct - Phase 5: Analytics Privacy Boundary Contracts
 * HackMatrix 5.0 - Track 02 (HLTH-01)
 *
 * CRITICAL BOUNDARY RESPONSIBILITIES:
 * 1. Security Workstream (Member 3 - THIS MODULE):
 *    - Strict gatekeeper for approved aggregate schemas.
 *    - Enforces group-size threshold ($k \ge 10$) using DISTINCT contributing patients.
 *    - Replaces small cells with honest `null` (NEVER zero, NEVER exact small count).
 *    - Rejects identifiable attributes, custom filters, and unknown dimensions.
 *    - Enforces complementary suppression to prevent subtraction leaks.
 *    - Enforces role boundaries: Administrator receives aggregates ONLY, strictly
 *      blocked from individual EHRs, exports, drilldowns, or emergency overrides.
 *
 * 2. Anomaly & Forecast Workstream (Member 4 - DOWNSTREAM CONSUMER):
 *    - Forecast implementation (ARIMA, EWMA, Prophet, ML).
 *    - Outbreak surge detection model & threshold alerting.
 *    - Baseline comparison & seasonal adjustment.
 *    - Holdout evaluation, false-alert reporting, model uncertainty.
 *    - MUST treat `caseCount: null` as honestly unavailable (cannot reconstruct).
 * ============================================================================
 */

export const APPROVED_REGIONS = [
  'District-North',
  'District-South',
  'District-East',
  'District-West',
  'Central-Metro',
] as const;
export type ApprovedRegion = (typeof APPROVED_REGIONS)[number];

export const APPROVED_CONDITION_CATEGORIES = [
  'Respiratory',
  'Waterborne',
  'Vectorborne',
  'Gastrointestinal',
  'Cardiometabolic',
] as const;
export type ApprovedConditionCategory = (typeof APPROVED_CONDITION_CATEGORIES)[number];

export const APPROVED_DATA_LABELS = [
  'SYNTHETIC_BENCHMARK',
  'GOVERNED_AGGREGATE',
  'APPROVED_SURVEILLANCE',
] as const;
export type ApprovedDataLabel = (typeof APPROVED_DATA_LABELS)[number];

// Fixed calendar period: Weekly "YYYY-Www" (e.g. 2026-W40) or Monthly "YYYY-MM" (e.g. 2026-10)
export const FIXED_PERIOD_REGEX = /^(\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])|\d{4}-(0[1-9]|1[0-2]))$/;

/**
 * Approved Model-Input Contract Schema
 * Strict Zod validation. Rejects unknown dimensions, extra properties, and identifiable fields.
 */
export const ApprovedModelInputRecordSchema = z
  .object({
    region: z.enum(APPROVED_REGIONS, {
      errorMap: () => ({ message: 'Region must be an approved governed public health region' }),
    }),
    timeBucket: z.string().regex(FIXED_PERIOD_REGEX, {
      message: 'timeBucket must be a fixed calendar period (e.g. "2026-W40" or "2026-10")',
    }),
    conditionCategory: z.enum(APPROVED_CONDITION_CATEGORIES, {
      errorMap: () => ({ message: 'Condition category must be an approved disease surveillance category' }),
    }),
    caseCount: z.number().int().nonnegative().nullable(),
    suppressed: z.boolean(),
    releaseVersion: z.string().min(1, { message: 'releaseVersion is mandatory' }),
    approvedDataLabel: z.enum(APPROVED_DATA_LABELS, {
      errorMap: () => ({ message: 'approvedDataLabel must be an approved governed data label' }),
    }),
    insufficientHistory: z.boolean().default(false),
  })
  .strict({
    message: 'Unknown dimensions or attributes are rejected by the analytics privacy boundary',
  })
  .refine(
    (data) => {
      // INVARIANT 1: Suppressed cells MUST be null, NEVER exact counts and NEVER zero!
      if (data.suppressed) {
        return data.caseCount === null;
      }
      // INVARIANT 2: Released cells MUST be >= 10
      return data.caseCount !== null && data.caseCount >= 10;
    },
    {
      message:
        'Privacy violation: Suppressed cells must have caseCount: null (never exact or 0). Unsuppressed cells must have caseCount >= 10.',
      path: ['caseCount'],
    }
  );

export type ApprovedModelInputRecord = z.infer<typeof ApprovedModelInputRecordSchema>;

/**
 * Raw Aggregate Input with Distinct Contributing Patients
 * Separate metric (case count) from eligibility metric (distinct patient count).
 */
export interface RawAggregateEventGroup {
  region: string;
  timeBucket: string;
  conditionCategory: string;
  distinctPatientIds: string[]; // Set of distinct patient IDs contributing
  caseCount: number; // Metric: total clinical encounters / cases
  releaseVersion?: string;
  approvedDataLabel?: ApprovedDataLabel;
}

export const FORBIDDEN_IDENTIFIABLE_KEYS = [
  'patientid',
  'patient_id',
  'userid',
  'user_id',
  'mrn',
  'name',
  'patientname',
  'firstname',
  'lastname',
  'address',
  'phone',
  'dob',
  'dateofbirth',
  'ssn',
  'nationalid',
  'recordid',
  'rawrecord',
  'clinicalnotes',
  'prescriptiondetails',
] as const;

/**
 * Counting Method & Group Eligibility Evaluation
 *
 * CRITICAL COUNTING RULE:
 * 1. The metric to report is `caseCount` (total recorded encounters / diagnoses).
 * 2. Group eligibility ($k \ge 10$) MUST be evaluated using DISTINCT contributing patients.
 * 3. Repeated visits by the same individual CANNOT inflate group-size eligibility.
 *    (e.g., 1 patient visiting 25 times gives distinctPatients = 1, so the cell is suppressed!)
 */
export function evaluateGroupEligibility(
  group: RawAggregateEventGroup,
  threshold: number = 10
): {
  caseCount: number | null;
  suppressed: boolean;
  distinctPatients: number;
  reason?: string;
} {
  const uniquePatients = new Set(group.distinctPatientIds.map((id) => id.trim().toLowerCase()));
  const distinctPatients = uniquePatients.size;

  // Zero cases: 0 is permitted only when distinctPatients is 0 (no cases recorded)
  if (distinctPatients === 0 && group.caseCount === 0) {
    return {
      caseCount: 0,
      suppressed: false,
      distinctPatients: 0,
    };
  }

  // If distinct patients are below threshold k (e.g. 1 to 9), MUST be suppressed as null!
  if (distinctPatients < threshold) {
    return {
      caseCount: null, // UNAVAILABLE, NOT ZERO!
      suppressed: true,
      distinctPatients,
      reason: `Group size (${distinctPatients} distinct patients) is below privacy threshold k=${threshold}`,
    };
  }

  return {
    caseCount: group.caseCount,
    suppressed: false,
    distinctPatients,
  };
}

/**
 * Complementary (Secondary) Suppression
 *
 * CRITICAL PRIVACY RULE:
 * If a marginal total or sibling cohort is released alongside a suppressed cell,
 * an adversary can compute: Suppressed = Total - Sum(Available).
 * To prevent subtraction reconstruction, if a group has exactly 1 suppressed category
 * and a total or sibling exists, the marginal total or second-smallest cell must also
 * be withheld / suppressed.
 */
export function applyComplementarySuppression(
  records: ApprovedModelInputRecord[],
  options?: { withholdTotals?: boolean }
): ApprovedModelInputRecord[] {
  const withholdTotals = options?.withholdTotals ?? true;

  // Group by region + timeBucket
  const slices = new Map<string, ApprovedModelInputRecord[]>();
  for (const r of records) {
    const key = `${r.region}:${r.timeBucket}`;
    const list = slices.get(key) ?? [];
    list.push(r);
    slices.set(key, list);
  }

  const result: ApprovedModelInputRecord[] = [];

  for (const [, slice] of slices.entries()) {
    const suppressedCells = slice.filter((c) => c.suppressed);
    const availableCells = slice.filter((c) => !c.suppressed && c.caseCount !== null);

    // If exactly ONE cell is suppressed and there are available siblings,
    // suppress the second smallest available cell to prevent subtraction leaks.
    if (suppressedCells.length === 1 && availableCells.length > 0) {
      // Find lowest available cell
      availableCells.sort((a, b) => (a.caseCount ?? 0) - (b.caseCount ?? 0));
      const victim = availableCells[0];

      for (const item of slice) {
        if (item === victim) {
          result.push({
            ...item,
            caseCount: null,
            suppressed: true,
          });
        } else {
          result.push(item);
        }
      }
    } else {
      for (const item of slice) {
        result.push(item);
      }
    }
  }

  return result;
}

/**
 * Runtime Validator for Approved Model Inputs
 * Rejects:
 * 1. Identifiable row payloads.
 * 2. Suppressed cells containing exact counts.
 * 3. Unknown dimensions or unapproved values.
 * 4. Custom unsupported filters.
 */
export function validateApprovedModelInputs(
  rows: unknown[],
  requestId: string = 'runtime-validation'
): ApprovedModelInputRecord[] {
  if (!Array.isArray(rows)) {
    throw new ValidationError('Aggregate feed must be an array of records.');
  }

  const validated: ApprovedModelInputRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (typeof row !== 'object' || row === null) {
      throw new ValidationError(`Record at index ${i} is not a valid object.`);
    }

    // 1. Detect forbidden identifiable keys
    const keys = Object.keys(row);
    for (const key of keys) {
      const lower = key.toLowerCase();
      for (const forbidden of FORBIDDEN_IDENTIFIABLE_KEYS) {
        if (lower === forbidden) {
          throw new ForbiddenError(
            `Privacy violation: Identifiable attribute '${key}' detected in model input feed.`,
            'IDENTIFIABLE_DATA_IN_AGGREGATE'
          );
        }
      }
    }

    // 2. Strict Zod schema validation
    const parsed = ApprovedModelInputRecordSchema.safeParse(row);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new ValidationError(
        `Model input contract violation at index ${i}: ${firstIssue?.message ?? 'Invalid schema'}`
      );
    }

    validated.push(parsed.data);
  }

  return validated;
}

/**
 * Aggregate-Only Authorization Helper for Administrator Routes
 *
 * ACCEPTANCE CRITERIA:
 * Administrator can receive approved aggregates, but CANNOT retrieve identifiable
 * records through analytics, exports, drilldowns, or emergency routes.
 */
export interface AggregateAuthorizationResult {
  authorized: boolean;
  actorUserId: string;
  actorRole: UserRole;
  isAggregateOnly: boolean;
  canAccessIdentifiableRecords: boolean;
}

export async function authorizeAggregateAccess(params: {
  actorUserId: string;
  identityRepo: IdentityRepository;
  auditService: AuditService;
  requestId: string;
  requestedResource: string;
}): Promise<AggregateAuthorizationResult> {
  const { actorUserId, identityRepo, auditService, requestId, requestedResource } = params;

  const userAccount = await identityRepo.getUserAccount(actorUserId);
  if (!userAccount || !userAccount.isActive) {
    await auditService.recordEvent({
      actorUserId,
      actorRole: null,
      action: 'ANALYTICS_AGGREGATE_CHECK',
      outcome: 'denied',
      internalReasonCode: 'INACTIVE_OR_UNKNOWN_USER',
      safeResourceRefs: { requestedResource },
      requestId,
    });
    throw new ForbiddenError('Account is inactive or not found.', 'ACCESS_DENIED');
  }

  const role = userAccount.role;

  // Allowed aggregate consumers: ADMIN and CLINICIAN
  if (role !== 'ADMIN' && role !== 'CLINICIAN') {
    await auditService.recordEvent({
      actorUserId,
      actorRole: role,
      action: 'ANALYTICS_AGGREGATE_CHECK',
      outcome: 'denied',
      internalReasonCode: 'FORBIDDEN_ROLE_FOR_AGGREGATES',
      safeResourceRefs: { requestedResource, role },
      requestId,
    });
    throw new ForbiddenError(
      'Patients cannot query regional disease surveillance aggregates.',
      'ACCESS_DENIED'
    );
  }

  // Audit safe access
  await auditService.recordEvent({
    actorUserId,
    actorRole: role,
    action: 'ANALYTICS_AGGREGATE_CHECK',
    outcome: 'allowed',
    internalReasonCode: 'AGGREGATE_ACCESS_AUTHORIZED',
    safeResourceRefs: {
      requestedResource,
      actorRole: role,
      isAggregateOnly: role === 'ADMIN',
    },
    requestId,
  });

  return {
    authorized: true,
    actorUserId,
    actorRole: role,
    isAggregateOnly: role === 'ADMIN',
    canAccessIdentifiableRecords: false, // Strict guarantee: aggregate helper never permits identifiable access
  };
}
