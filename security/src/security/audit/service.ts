import { SecurityRepository } from '../contracts/interfaces.js';
import { AuditEventRecord, AuditOutcome } from '../contracts/types.js';
import { safeLog } from '../middleware/redact.js';

export class AuditPersistenceError extends Error {
  constructor(message = 'Security audit log persistence failed') {
    super(message);
    this.name = 'AuditPersistenceError';
  }
}

export class AuditService {
  constructor(private readonly securityRepo: SecurityRepository) {}

  /**
   * Persists an audit event to the append-only database audit log.
   *
   * @param event The audit event data (safe resource references only, no clinical data)
   * @param allowFallback If true (e.g. revocation), audit write failures log a fallback warning
   *                      rather than throwing, allowing safety-critical revocations to succeed.
   *                      If false (consent creation, grants, clinical release), failures throw
   *                      and cause the operation to fail closed.
   */
  async recordEvent(
    event: {
      timestamp?: Date;
      actorUserId: string | null;
      actorRole: string | null;
      action: string;
      outcome: AuditOutcome;
      internalReasonCode: string;
      safeResourceRefs: Record<string, string | number | boolean | null>;
      requestId: string;
    },
    allowFallback = false
  ): Promise<AuditEventRecord | null> {
    const payload = {
      timestamp: event.timestamp ?? new Date(),
      actorUserId: event.actorUserId,
      actorRole: event.actorRole,
      action: event.action,
      outcome: event.outcome,
      internalReasonCode: event.internalReasonCode,
      safeResourceRefs: event.safeResourceRefs,
      requestId: event.requestId,
    };

    try {
      return await this.securityRepo.appendAuditEvent(payload);
    } catch (err) {
      // Safe operational fallback containing zero clinical or sensitive content
      safeLog('[CRITICAL_AUDIT_FALLBACK_FAILURE]', {
        action: payload.action,
        outcome: payload.outcome,
        internalReasonCode: payload.internalReasonCode,
        requestId: payload.requestId,
        error: (err as Error).message,
      });

      if (!allowFallback) {
        throw new AuditPersistenceError(
          'Security audit logging failed; operation failed closed to preserve compliance integrity.'
        );
      }

      return null;
    }
  }
}
