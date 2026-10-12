import crypto from 'node:crypto';
import {
  Clock,
  SystemClock,
  IdentityRepository,
  SecurityRepository,
} from '../contracts/interfaces.js';
import { GenerateQrInput, ResolveQrInput } from '../contracts/schemas.js';
import { AccessGrantRecord, Scope } from '../contracts/types.js';
import { AuditService } from '../audit/service.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../middleware/errorHandler.js';

export interface QrGenerationResult {
  payload: string;
  expiresAt: string;
}

export interface QrResolutionResult {
  accessGrantId: string;
  patientId: string;
  scopes: Scope[];
  expiresAt: string;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sanitizeQrTokenInput(inputToken: string): string {
  const trimmed = inputToken.trim();
  if (trimmed.startsWith('MEDVIADUCT:v1:')) {
    return trimmed.substring('MEDVIADUCT:v1:'.length);
  }
  return trimmed;
}

export class QrService {
  private readonly clock: Clock;

  constructor(
    private readonly identityRepo: IdentityRepository,
    private readonly securityRepo: SecurityRepository,
    private readonly auditService: AuditService,
    clock?: Clock
  ) {
    this.clock = clock ?? new SystemClock();
  }

  async generateQr(params: {
    userId: string;
    input: GenerateQrInput;
    requestId: string;
  }): Promise<QrGenerationResult> {
    const { userId, input, requestId } = params;

    // 1. Resolve Patient profile
    const patientProfile = await this.identityRepo.getPatientByUserId(userId);
    if (!patientProfile) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'PATIENT',
        action: 'QR_GENERATE',
        outcome: 'denied',
        internalReasonCode: 'PATIENT_PROFILE_REQUIRED',
        safeResourceRefs: { consentId: input.consentId },
        requestId,
      });
      throw new ForbiddenError(
        'You must have a registered patient profile to generate access QR codes.',
        'PATIENT_PROFILE_REQUIRED'
      );
    }

    // 2. Fetch and verify consent ownership
    const consent = await this.securityRepo.getConsentById(input.consentId);
    if (!consent || consent.patientId !== patientProfile.id) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'PATIENT',
        action: 'QR_GENERATE',
        outcome: 'denied',
        internalReasonCode: 'CONSENT_NOT_FOUND_OR_FORBIDDEN',
        safeResourceRefs: { attemptedConsentId: input.consentId },
        requestId,
      });
      throw new NotFoundError('Consent not found.', 'CONSENT_NOT_FOUND');
    }

    const now = this.clock.now();

    // 3. Verify consent is active and unexpired
    if (
      consent.status === 'revoked' ||
      consent.revokedAt !== null ||
      now.getTime() >= consent.expiresAt.getTime()
    ) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'PATIENT',
        action: 'QR_GENERATE',
        outcome: 'denied',
        internalReasonCode: 'CONSENT_EXPIRED_OR_REVOKED',
        safeResourceRefs: {
          consentId: consent.id,
          status: consent.status,
          expiresAt: consent.expiresAt.toISOString(),
        },
        requestId,
      });
      throw new ValidationError(
        'Cannot generate QR invitation for an expired or revoked consent.',
        'CONSENT_INACTIVE'
      );
    }

    // 4. Compute QR token lifetime (5 minutes, capped at consent expiry)
    const fiveMinutesMs = 5 * 60 * 1000;
    const prospectiveExpiryMs = now.getTime() + fiveMinutesMs;
    const tokenExpiryMs = Math.min(prospectiveExpiryMs, consent.expiresAt.getTime());

    if (tokenExpiryMs <= now.getTime()) {
      throw new ValidationError(
        'Consent has already reached expiration.',
        'CONSENT_EXPIRED'
      );
    }

    const qrExpiresAt = new Date(tokenExpiryMs);

    // 5. Generate at least 32 cryptographically secure random bytes
    const randomBytes = crypto.randomBytes(32);
    const opaqueToken = randomBytes.toString('hex'); // 64 hex characters
    const tokenHash = hashToken(opaqueToken);

    // 6. Invalidate previous unused tokens and persist SHA-256 hash
    const qrRecord = await this.securityRepo.createQrToken({
      consentId: consent.id,
      tokenHash,
      expiresAt: qrExpiresAt,
    });

    // 7. Persistent audit event (no raw token in audit log)
    await this.auditService.recordEvent({
      actorUserId: userId,
      actorRole: 'PATIENT',
      action: 'QR_GENERATE',
      outcome: 'allowed',
      internalReasonCode: 'QR_GENERATED_SUCCESS',
      safeResourceRefs: {
        consentId: consent.id,
        qrTokenId: qrRecord.id,
        expiresAt: qrExpiresAt.toISOString(),
      },
      requestId,
    });

    // 8. Return formatted opaque payload (NEVER contains clinical or patient details)
    return {
      payload: `MEDVIADUCT:v1:${opaqueToken}`,
      expiresAt: qrExpiresAt.toISOString(),
    };
  }

  async resolveQr(params: {
    userId: string;
    input: ResolveQrInput;
    requestId: string;
  }): Promise<QrResolutionResult> {
    const { userId, input, requestId } = params;

    // 1-3. Authenticate and verify active clinician
    const clinicianAccount = await this.identityRepo.getUserAccount(userId);
    const clinicianProfile = await this.identityRepo.getClinicianByUserId(userId);

    if (
      !clinicianAccount ||
      clinicianAccount.role !== 'CLINICIAN' ||
      !clinicianAccount.isActive ||
      !clinicianProfile ||
      !clinicianProfile.isVerified
    ) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: clinicianAccount?.role ?? null,
        action: 'QR_RESOLVE',
        outcome: 'denied',
        internalReasonCode: 'CLINICIAN_UNVERIFIED_OR_FORBIDDEN',
        safeResourceRefs: {
          isVerified: clinicianProfile?.isVerified ?? false,
          role: clinicianAccount?.role ?? null,
        },
        requestId,
      });
      throw new ForbiddenError(
        'Access denied: You must be an active, verified clinician to resolve QR invitations.',
        'ACCESS_DENIED'
      );
    }

    // 4. Sanitize and bound token
    const rawToken = sanitizeQrTokenInput(input.token);
    if (rawToken.length < 16) {
      throw new ForbiddenError(
        'The QR invitation is invalid or no longer available.',
        'QR_ACCESS_UNAVAILABLE'
      );
    }

    // 5. Hash token and locate record
    const tokenHash = hashToken(rawToken);
    const qrRecord = await this.securityRepo.findQrTokenByHash(tokenHash);

    if (!qrRecord) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'QR_RESOLVE',
        outcome: 'denied',
        internalReasonCode: 'QR_TOKEN_NOT_FOUND',
        safeResourceRefs: { clinicianId: clinicianProfile.id },
        requestId,
      });
      throw new ForbiddenError(
        'The QR invitation is invalid or no longer available.',
        'QR_ACCESS_UNAVAILABLE'
      );
    }

    const now = this.clock.now();

    // 6. Check token status
    if (qrRecord.revokedAt !== null) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'QR_RESOLVE',
        outcome: 'denied',
        internalReasonCode: 'QR_TOKEN_REVOKED',
        safeResourceRefs: { qrTokenId: qrRecord.id, clinicianId: clinicianProfile.id },
        requestId,
      });
      throw new ForbiddenError(
        'The QR invitation is invalid or no longer available.',
        'QR_ACCESS_UNAVAILABLE'
      );
    }

    if (qrRecord.consumedAt !== null) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'QR_RESOLVE',
        outcome: 'denied',
        internalReasonCode: 'QR_TOKEN_ALREADY_CONSUMED',
        safeResourceRefs: { qrTokenId: qrRecord.id, clinicianId: clinicianProfile.id },
        requestId,
      });
      throw new ForbiddenError(
        'The QR invitation is invalid or no longer available.',
        'QR_ACCESS_UNAVAILABLE'
      );
    }

    if (now.getTime() >= qrRecord.expiresAt.getTime()) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'QR_RESOLVE',
        outcome: 'denied',
        internalReasonCode: 'QR_TOKEN_EXPIRED',
        safeResourceRefs: { qrTokenId: qrRecord.id, clinicianId: clinicianProfile.id },
        requestId,
      });
      throw new ForbiddenError(
        'The QR invitation is invalid or no longer available.',
        'QR_ACCESS_UNAVAILABLE'
      );
    }

    // 7. Check current consent
    const consent = await this.securityRepo.getConsentById(qrRecord.consentId);
    if (
      !consent ||
      consent.status === 'revoked' ||
      consent.revokedAt !== null ||
      now.getTime() >= consent.expiresAt.getTime()
    ) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'QR_RESOLVE',
        outcome: 'denied',
        internalReasonCode: 'CONSENT_EXPIRED_OR_REVOKED',
        safeResourceRefs: { qrTokenId: qrRecord.id, clinicianId: clinicianProfile.id },
        requestId,
      });
      throw new ForbiddenError(
        'The QR invitation is invalid or no longer available.',
        'QR_ACCESS_UNAVAILABLE'
      );
    }

    // 8. Confirm clinician matches the consent
    // SECURITY INVARIANT: An unauthorized attempt by a different clinician MUST NOT consume the token!
    if (consent.clinicianId !== clinicianProfile.id) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'QR_RESOLVE',
        outcome: 'denied',
        internalReasonCode: 'CLINICIAN_MISMATCH',
        safeResourceRefs: {
          qrTokenId: qrRecord.id,
          attemptedClinicianId: clinicianProfile.id,
          expectedClinicianId: consent.clinicianId,
        },
        requestId,
      });
      throw new ForbiddenError(
        'The QR invitation is invalid or no longer available.',
        'QR_ACCESS_UNAVAILABLE'
      );
    }

    // 9. Compute grant lifetime (15 minutes, never beyond consent expiry)
    const fifteenMinutesMs = 15 * 60 * 1000;
    const prospectiveGrantExpiryMs = now.getTime() + fifteenMinutesMs;
    const grantExpiryMs = Math.min(prospectiveGrantExpiryMs, consent.expiresAt.getTime());
    const grantExpiresAt = new Date(grantExpiryMs);

    // 10. Atomically consume token and create access grant
    let grant: AccessGrantRecord;
    try {
      grant = await this.securityRepo.consumeQrTokenAndCreateGrant({
        qrTokenId: qrRecord.id,
        consentId: consent.id,
        patientId: consent.patientId,
        clinicianId: clinicianProfile.id,
        scopes: consent.scopes,
        grantExpiresAt,
      });
    } catch {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'QR_RESOLVE',
        outcome: 'denied',
        internalReasonCode: 'QR_RACE_OR_ALREADY_CONSUMED',
        safeResourceRefs: { qrTokenId: qrRecord.id, clinicianId: clinicianProfile.id },
        requestId,
      });
      throw new ForbiddenError(
        'The QR invitation is invalid or no longer available.',
        'QR_ACCESS_UNAVAILABLE'
      );
    }

    // 11. Audit resolution
    // SECURITY INVARIANT: If audit persistence fails, grant is immediately revoked to fail closed
    try {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'QR_RESOLVE',
        outcome: 'allowed',
        internalReasonCode: 'QR_RESOLVED_GRANT_ISSUED',
        safeResourceRefs: {
          qrTokenId: qrRecord.id,
          accessGrantId: grant.id,
          patientId: consent.patientId,
          clinicianId: clinicianProfile.id,
        },
        requestId,
      });
    } catch (auditErr) {
      // Rollback grant if audit write fails
      await this.securityRepo.revokeConsentAndAssociatedGrants(consent.id, this.clock.now());
      throw auditErr;
    }

    return {
      accessGrantId: grant.id,
      patientId: consent.patientId,
      scopes: grant.scopes,
      expiresAt: grant.expiresAt.toISOString(),
    };
  }
}
