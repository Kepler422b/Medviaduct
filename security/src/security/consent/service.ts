import {
  Clock,
  SystemClock,
  IdentityRepository,
  SecurityRepository,
} from '../contracts/interfaces.js';
import { CreateConsentInput } from '../contracts/schemas.js';
import { ConsentRecord, EffectiveConsentStatus } from '../contracts/types.js';
import { AuditService } from '../audit/service.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../middleware/errorHandler.js';

export interface ConsentViewModel {
  id: string;
  patientId: string;
  clinicianId: string;
  scopes: string[];
  status: string;
  effectiveStatus: EffectiveConsentStatus;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export function computeEffectiveStatus(
  consent: Pick<ConsentRecord, 'status' | 'expiresAt' | 'revokedAt'>,
  clock: Clock
): EffectiveConsentStatus {
  if (consent.status === 'revoked' || consent.revokedAt !== null) {
    return 'revoked';
  }
  if (clock.now().getTime() >= consent.expiresAt.getTime()) {
    return 'expired';
  }
  return 'active';
}

export class ConsentService {
  private readonly clock: Clock;

  constructor(
    private readonly identityRepo: IdentityRepository,
    private readonly securityRepo: SecurityRepository,
    private readonly auditService: AuditService,
    clock?: Clock
  ) {
    this.clock = clock ?? new SystemClock();
  }

  async createConsent(params: {
    userId: string;
    input: CreateConsentInput;
    requestId: string;
  }): Promise<ConsentViewModel> {
    const { userId, input, requestId } = params;

    // 1. Resolve Patient profile from authenticated account
    const patientProfile = await this.identityRepo.getPatientByUserId(userId);
    if (!patientProfile) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'PATIENT',
        action: 'CONSENT_CREATE',
        outcome: 'denied',
        internalReasonCode: 'PATIENT_PROFILE_NOT_FOUND',
        safeResourceRefs: { attemptedClinicianId: input.clinicianId },
        requestId,
      });
      throw new ForbiddenError(
        'You must have a registered patient profile to manage consents.',
        'PATIENT_PROFILE_REQUIRED'
      );
    }

    // 2. Resolve Clinician profile and verify account status
    const clinicianProfile = await this.identityRepo.getClinicianById(input.clinicianId);
    if (!clinicianProfile) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'PATIENT',
        action: 'CONSENT_CREATE',
        outcome: 'denied',
        internalReasonCode: 'CLINICIAN_NOT_FOUND',
        safeResourceRefs: { patientId: patientProfile.id, clinicianId: input.clinicianId },
        requestId,
      });
      throw new ValidationError('Target clinician does not exist.', 'CLINICIAN_NOT_FOUND');
    }

    const clinicianAccount = await this.identityRepo.getUserAccount(clinicianProfile.userId);
    if (!clinicianAccount || !clinicianAccount.isActive || !clinicianProfile.isVerified) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'PATIENT',
        action: 'CONSENT_CREATE',
        outcome: 'denied',
        internalReasonCode: 'CLINICIAN_NOT_ACTIVE_OR_UNVERIFIED',
        safeResourceRefs: {
          patientId: patientProfile.id,
          clinicianId: clinicianProfile.id,
          isVerified: clinicianProfile.isVerified,
        },
        requestId,
      });
      throw new ForbiddenError(
        'Target clinician must be active and verified.',
        'CLINICIAN_NOT_VERIFIED'
      );
    }

    // 3. Compute server-side expiry timestamp
    const now = this.clock.now();
    const durationMinutes = input.durationMinutes ?? 30;
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    // 4. Persist consent in database
    const consent = await this.securityRepo.createConsent({
      patientId: patientProfile.id,
      clinicianId: clinicianProfile.id,
      scopes: input.scopes,
      expiresAt,
      createdByUserId: userId,
    });

    // 5. Audit persistence (must succeed; throws on audit outage so creation fails closed)
    await this.auditService.recordEvent({
      actorUserId: userId,
      actorRole: 'PATIENT',
      action: 'CONSENT_CREATE',
      outcome: 'allowed',
      internalReasonCode: 'CONSENT_CREATED_SUCCESS',
      safeResourceRefs: {
        consentId: consent.id,
        patientId: patientProfile.id,
        clinicianId: clinicianProfile.id,
        durationMinutes,
      },
      requestId,
    });

    return {
      id: consent.id,
      patientId: consent.patientId,
      clinicianId: consent.clinicianId,
      scopes: consent.scopes,
      status: consent.status,
      effectiveStatus: computeEffectiveStatus(consent, this.clock),
      createdAt: consent.createdAt.toISOString(),
      expiresAt: consent.expiresAt.toISOString(),
      revokedAt: consent.revokedAt ? consent.revokedAt.toISOString() : null,
    };
  }

  async listConsents(params: {
    userId: string;
    requestId: string;
  }): Promise<ConsentViewModel[]> {
    const { userId, requestId } = params;

    const patientProfile = await this.identityRepo.getPatientByUserId(userId);
    if (!patientProfile) {
      throw new ForbiddenError(
        'You must have a registered patient profile to view consents.',
        'PATIENT_PROFILE_REQUIRED'
      );
    }

    const consents = await this.securityRepo.getConsentsByPatientId(patientProfile.id);

    return consents.map((c) => ({
      id: c.id,
      patientId: c.patientId,
      clinicianId: c.clinicianId,
      scopes: c.scopes,
      status: c.status,
      effectiveStatus: computeEffectiveStatus(c, this.clock),
      createdAt: c.createdAt.toISOString(),
      expiresAt: c.expiresAt.toISOString(),
      revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
    }));
  }

  async revokeConsent(params: {
    userId: string;
    consentId: string;
    requestId: string;
  }): Promise<ConsentViewModel> {
    const { userId, consentId, requestId } = params;

    const patientProfile = await this.identityRepo.getPatientByUserId(userId);
    if (!patientProfile) {
      throw new ForbiddenError(
        'You must have a registered patient profile to revoke consents.',
        'PATIENT_PROFILE_REQUIRED'
      );
    }

    const consent = await this.securityRepo.getConsentById(consentId);
    // Non-disclosing 404 response for non-existent or foreign consent
    if (!consent || consent.patientId !== patientProfile.id) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'PATIENT',
        action: 'CONSENT_REVOKE',
        outcome: 'denied',
        internalReasonCode: 'CONSENT_NOT_FOUND_OR_FORBIDDEN',
        safeResourceRefs: { attemptedConsentId: consentId },
        requestId,
      });
      throw new NotFoundError('Consent not found.', 'CONSENT_NOT_FOUND');
    }

    const now = this.clock.now();
    const revoked = await this.securityRepo.revokeConsentAndAssociatedGrants(consent.id, now);

    // Audit with fallback allowed: revocation must remain effective even if audit storage suffers outage
    await this.auditService.recordEvent(
      {
        actorUserId: userId,
        actorRole: 'PATIENT',
        action: 'CONSENT_REVOKE',
        outcome: 'allowed',
        internalReasonCode: 'CONSENT_REVOKED_SUCCESS',
        safeResourceRefs: {
          consentId: consent.id,
          patientId: patientProfile.id,
          clinicianId: consent.clinicianId,
        },
        requestId,
      },
      true // allowFallback
    );

    const result = revoked ?? consent;
    return {
      id: result.id,
      patientId: result.patientId,
      clinicianId: result.clinicianId,
      scopes: result.scopes,
      status: 'revoked',
      effectiveStatus: 'revoked',
      createdAt: result.createdAt.toISOString(),
      expiresAt: result.expiresAt.toISOString(),
      revokedAt: (result.revokedAt ?? now).toISOString(),
    };
  }
}
