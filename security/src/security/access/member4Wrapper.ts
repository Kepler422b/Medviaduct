import { AccessAuthorizer } from './authorizer.js';
import { AuditService } from '../audit/service.js';

export interface ClinicalSummaryRequest {
  actorUserId: string;
  patientId: string;
  accessGrantId: string;
  requestId: string;
}

/**
 * ClinicalSummarySecurityWrapper
 * Ready-to-use security wrapper for Member 4 (AI Summaries / Clinical Analytics).
 *
 * GUARANTEES:
 * 1. Checks 'clinical-summary:generate' authorization before records or AI models are invoked.
 * 2. Pulls records server-side only; client-supplied clinical histories are never trusted.
 * 3. Rechecks authorization AFTER model generation to detect revocations during AI processing.
 * 4. Ensures audit logging succeeds before content is returned; fails closed on audit errors.
 */
export class ClinicalSummarySecurityWrapper {
  constructor(
    private readonly authorizer: AccessAuthorizer,
    private readonly auditService: AuditService
  ) {}

  async executeProtectedSummaryGeneration<TRecord, TSummary>(
    params: ClinicalSummaryRequest,
    fetchRecordsServerSide: (patientId: string) => Promise<TRecord>,
    invokeAiSummaryModel: (records: TRecord) => Promise<TSummary>
  ): Promise<TSummary> {
    // 1. Initial pre-generation authorization check
    await this.authorizer.authorizePatientAccess({
      actorUserId: params.actorUserId,
      patientId: params.patientId,
      requiredScope: 'clinical-summary:generate',
      accessGrantId: params.accessGrantId,
      requestId: params.requestId,
    });

    // 2. Fetch records strictly server-side
    const records = await fetchRecordsServerSide(params.patientId);

    // 3. Invoke Member 4's model
    const summary = await invokeAiSummaryModel(records);

    // 4. Critical re-check: Verify consent and grant were not revoked during model latency
    await this.authorizer.authorizePatientAccess({
      actorUserId: params.actorUserId,
      patientId: params.patientId,
      requiredScope: 'clinical-summary:generate',
      accessGrantId: params.accessGrantId,
      requestId: params.requestId,
    });

    // 5. Audit the release
    await this.auditService.recordEvent({
      actorUserId: params.actorUserId,
      actorRole: 'CLINICIAN',
      action: 'AI_SUMMARY_RELEASE',
      outcome: 'allowed',
      internalReasonCode: 'SUMMARY_RELEASED_AFTER_VERIFICATION',
      safeResourceRefs: {
        patientId: params.patientId,
        accessGrantId: params.accessGrantId,
      },
      requestId: params.requestId,
    });

    return summary;
  }

  async reauthorizeCachedSummaryAccess<TSummary>(
    params: ClinicalSummaryRequest,
    fetchCachedSummaryServerSide: (patientId: string) => Promise<TSummary | null>
  ): Promise<TSummary | null> {
    await this.authorizer.authorizePatientAccess({
      actorUserId: params.actorUserId,
      patientId: params.patientId,
      requiredScope: 'clinical-summary:generate',
      accessGrantId: params.accessGrantId,
      requestId: params.requestId,
    });

    return await fetchCachedSummaryServerSide(params.patientId);
  }
}
