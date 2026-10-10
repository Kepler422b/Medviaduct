import { AuditService } from '../audit/service.js';
import {
  PermittedAggregateRecord,
  SuppressionStatus,
} from '../contracts/types.js';
import {
  PermittedAggregateRecordSchema,
} from '../contracts/schemas.js';
import { ForbiddenError, ValidationError } from '../middleware/errorHandler.js';

export interface RawAggregateBucket {
  region: string;
  timeBucket: string;
  conditionCategory: string;
  count: number;
  [key: string]: unknown;
}

export interface PrivacyBoundaryConfig {
  minimumGroupThreshold: number; // Default k = 10
}

/**
 * Forbidden identifiable fields that must NEVER appear in aggregate feeds
 * passed to anomaly detection models or public health administrator views.
 */
const FORBIDDEN_IDENTIFIABLE_FIELDS = [
  'patientId',
  'patient_id',
  'userId',
  'user_id',
  'mrn',
  'name',
  'patientName',
  'firstName',
  'lastName',
  'address',
  'phone',
  'dob',
  'dateOfBirth',
  'ssn',
  'nationalId',
  'recordId',
  'rawRecord',
  'clinicalNotes',
  'prescriptionDetails',
];

export class PrivacyBoundaryService {
  private readonly threshold: number;

  constructor(
    private readonly auditService: AuditService,
    config?: Partial<PrivacyBoundaryConfig>
  ) {
    this.threshold = config?.minimumGroupThreshold ?? 10;
  }

  get minimumThreshold(): number {
    return this.threshold;
  }

  /**
   * Inspects a dataset and ensures NO identifiable fields or individual records exist.
   * Throws ForbiddenError if identifiable fields are detected.
   */
  assertNoIdentifiableFields(records: unknown[], requestId: string): void {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (typeof record !== 'object' || record === null) continue;

      const keys = Object.keys(record);
      for (const key of keys) {
        const lowerKey = key.toLowerCase();
        for (const forbidden of FORBIDDEN_IDENTIFIABLE_FIELDS) {
          if (lowerKey === forbidden.toLowerCase()) {
            throw new ForbiddenError(
              `Privacy violation: Identifiable attribute '${key}' detected in aggregate feed.`,
              'IDENTIFIABLE_DATA_IN_AGGREGATE'
            );
          }
        }
      }
    }
  }

  /**
   * Applies group-size threshold suppression ($k \ge 10$).
   *
   * CRITICAL SECURITY INVARIANT:
   * When a group count is below the minimum threshold ($1 \le count < k$),
   * the count MUST be represented as unavailable (`null`), NOT as `0`.
   * Setting suppressed counts to zero corrupts baseline statistics and allows
   * adversarial reconstruction.
   */
  applyGroupSizeSuppression(rawCount: number): {
    caseCount: number | null;
    suppressionStatus: SuppressionStatus;
    thresholdApplied: number;
  } {
    if (rawCount > 0 && rawCount < this.threshold) {
      return {
        caseCount: null, // UNAVAILABLE, NOT ZERO!
        suppressionStatus: 'suppressed_unavailable',
        thresholdApplied: this.threshold,
      };
    }

    return {
      caseCount: rawCount,
      suppressionStatus: 'available',
      thresholdApplied: this.threshold,
    };
  }

  /**
   * Sanitizes and protects raw aggregate histories for Member 4's anomaly detection
   * models and public health administrator views.
   */
  async sanitizeAndProtectAggregateFeed(
    rawBuckets: RawAggregateBucket[],
    params: {
      actorUserId?: string;
      actorRole?: string;
      requestId: string;
      modelConsumer?: string;
    }
  ): Promise<PermittedAggregateRecord[]> {
    const { actorUserId, actorRole, requestId, modelConsumer = 'MEMBER_4_ANOMALY_MODEL' } = params;

    // 1. Assert no identifiable patient fields exist in the feed
    try {
      this.assertNoIdentifiableFields(rawBuckets, requestId);
    } catch (err) {
      await this.auditService.recordEvent({
        actorUserId: actorUserId ?? null,
        actorRole: actorRole ?? null,
        action: 'PRIVACY_BOUNDARY_CHECK',
        outcome: 'denied',
        internalReasonCode: 'IDENTIFIABLE_PATIENT_DATA_IN_AGGREGATE_FEED',
        safeResourceRefs: { modelConsumer, bucketCount: rawBuckets.length },
        requestId,
      });
      throw err;
    }

    // 2. Process each bucket, enforce k-suppression, and construct sanitized records
    let suppressedCount = 0;
    const permittedRecords: PermittedAggregateRecord[] = [];

    for (const bucket of rawBuckets) {
      if (typeof bucket.region !== 'string' || !bucket.region.trim()) {
        throw new ValidationError('Region is required for aggregate records.');
      }
      if (typeof bucket.timeBucket !== 'string' || !bucket.timeBucket.trim()) {
        throw new ValidationError('Time bucket is required for aggregate records.');
      }
      if (typeof bucket.conditionCategory !== 'string' || !bucket.conditionCategory.trim()) {
        throw new ValidationError('Condition category is required for aggregate records.');
      }

      const { caseCount, suppressionStatus, thresholdApplied } = this.applyGroupSizeSuppression(
        bucket.count
      );

      if (suppressionStatus === 'suppressed_unavailable') {
        suppressedCount++;
      }

      const record: PermittedAggregateRecord = {
        region: bucket.region.trim(),
        timeBucket: bucket.timeBucket.trim(),
        conditionCategory: bucket.conditionCategory.trim(),
        caseCount,
        suppressionStatus,
        thresholdApplied,
      };

      // Validate against strict Zod schema
      const parsed = PermittedAggregateRecordSchema.parse(record);
      permittedRecords.push(parsed);
    }

    // 3. Audit safe aggregate feed release
    await this.auditService.recordEvent({
      actorUserId: actorUserId ?? null,
      actorRole: actorRole ?? null,
      action: 'PRIVACY_AGGREGATE_FEED_RELEASED',
      outcome: 'allowed',
      internalReasonCode: 'AGGREGATE_DATA_SANITIZED_AND_SUPPRESSED',
      safeResourceRefs: {
        modelConsumer,
        totalGroups: permittedRecords.length,
        suppressedGroups: suppressedCount,
        threshold: this.threshold,
      },
      requestId,
    });

    return permittedRecords;
  }

  /**
   * Phase 5: Produces governed Model-Input records enforcing distinct contributing patient counts.
   * Repeated visits by the same patient cannot inflate group-size eligibility!
   */
  async produceGovernedModelInputFeed(
    rawGroups: import('./modelInputContract.js').RawAggregateEventGroup[],
    params: {
      actorUserId?: string;
      actorRole?: string;
      requestId: string;
      releaseVersion?: string;
      approvedDataLabel?: import('./modelInputContract.js').ApprovedDataLabel;
      withComplementarySuppression?: boolean;
    }
  ): Promise<import('./modelInputContract.js').ApprovedModelInputRecord[]> {
    const {
      actorUserId,
      actorRole,
      requestId,
      releaseVersion = 'v1.0-2026',
      approvedDataLabel = 'GOVERNED_AGGREGATE',
      withComplementarySuppression = true,
    } = params;

    const {
      evaluateGroupEligibility,
      applyComplementarySuppression,
      validateApprovedModelInputs,
    } = await import('./modelInputContract.js');

    const unsuppressedOrBasicSuppressed: import('./modelInputContract.js').ApprovedModelInputRecord[] = [];

    for (const group of rawGroups) {
      const eligibility = evaluateGroupEligibility(group, this.threshold);
      const record: import('./modelInputContract.js').ApprovedModelInputRecord = {
        region: group.region as import('./modelInputContract.js').ApprovedRegion,
        timeBucket: group.timeBucket,
        conditionCategory: group.conditionCategory as import('./modelInputContract.js').ApprovedConditionCategory,
        caseCount: eligibility.caseCount,
        suppressed: eligibility.suppressed,
        releaseVersion: group.releaseVersion ?? releaseVersion,
        approvedDataLabel: group.approvedDataLabel ?? approvedDataLabel,
        insufficientHistory: false,
      };
      unsuppressedOrBasicSuppressed.push(record);
    }

    const finalRecords = withComplementarySuppression
      ? applyComplementarySuppression(unsuppressedOrBasicSuppressed)
      : unsuppressedOrBasicSuppressed;

    // Runtime validation pass
    const validated = validateApprovedModelInputs(finalRecords, requestId);

    // Attributable audit event
    await this.auditService.recordEvent({
      actorUserId: actorUserId ?? null,
      actorRole: actorRole ?? null,
      action: 'APPROVED_MODEL_INPUT_FEED_RELEASED',
      outcome: 'allowed',
      internalReasonCode: 'GOVERNED_AGGREGATES_RELEASED_TO_MODEL',
      safeResourceRefs: {
        totalRecords: validated.length,
        suppressedCount: validated.filter((r) => r.suppressed).length,
        threshold: this.threshold,
        releaseVersion,
      },
      requestId,
    });

    return validated;
  }
}

export * from './modelInputContract.js';
