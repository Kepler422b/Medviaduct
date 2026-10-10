import { Request, Response, NextFunction } from 'express';
import {
  Clock,
  SystemClock,
  IdentityRepository,
  SecurityRepository,
} from '../contracts/interfaces.js';
import { Scope, UserRole } from '../contracts/types.js';
import { AuditService } from '../audit/service.js';
import { ForbiddenError } from '../middleware/errorHandler.js';

export type AccessMode = 'PATIENT_SELF' | 'NORMAL_CONSENT' | 'EMERGENCY_OVERRIDE';

export interface AuthorizeAccessParams {
  actorUserId: string;
  patientId: string;
  requiredScope: Scope;
  accessGrantId?: string;
  requestId?: string;
  resourcePath?: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  accessMode: AccessMode;
  actorRole: UserRole;
  actorId: string;
  patientId: string;
  grantId?: string;
  scopes: Scope[];
  isEmergency: boolean;
  safeResourceRefs: Record<string, string | number | boolean | null>;
}

declare global {
  namespace Express {
    interface Request {
      accessResult?: AuthorizationResult;
    }
  }
}

export class AccessAuthorizer {
  private readonly clock: Clock;

  constructor(
    private readonly identityRepo: IdentityRepository,
    private readonly securityRepo: SecurityRepository,
    private readonly auditService: AuditService,
    clock?: Clock
  ) {
    this.clock = clock ?? new SystemClock();
  }

  /**
   * Central authorization engine for all patient records and clinical summaries.
   *
   * SECURITY INVARIANTS ENFORCED:
   * 1. Authentication alone does NOT grant patient record access.
   * 2. Direct patient-ID requests cannot bypass authorization.
   * 3. Administrators can NEVER access identifiable clinical records.
   * 4. Patients can access only their own records, and cannot generate clinician summaries.
   * 5. Clinicians require an active, verified account + explicit unexpired/unrevoked access grant + active consent (or active emergency grant).
   * 6. Both grant and consent must explicitly include the required scope.
   * 7. Audit log write must succeed before data is released (fails closed if audit fails).
   */
  async authorizePatientAccess(params: AuthorizeAccessParams): Promise<AuthorizationResult> {
    const {
      actorUserId,
      patientId,
      requiredScope,
      accessGrantId,
      requestId = 'internal',
      resourcePath = 'patient_record',
    } = params;

    // 1. Resolve actor account from trusted database
    const actorAccount = await this.identityRepo.getUserAccount(actorUserId);
    if (!actorAccount || !actorAccount.isActive) {
      await this.auditService.recordEvent({
        actorUserId,
        actorRole: null,
        action: 'RECORD_ACCESS_CHECK',
        outcome: 'denied',
        internalReasonCode: 'ACTOR_ACCOUNT_INACTIVE_OR_NOT_FOUND',
        safeResourceRefs: { targetPatientId: patientId, requiredScope },
        requestId,
      });
      throw new ForbiddenError(
        'Access denied: User account is inactive or not found.',
        'ACCESS_DENIED'
      );
    }

    // 2. Administrators: Strictly forbidden from accessing identifiable clinical records
    if (actorAccount.role === 'ADMIN') {
      await this.auditService.recordEvent({
        actorUserId,
        actorRole: 'ADMIN',
        action: 'RECORD_ACCESS_CHECK',
        outcome: 'denied',
        internalReasonCode: 'ADMIN_IDENTIFIABLE_ACCESS_FORBIDDEN',
        safeResourceRefs: { targetPatientId: patientId, requiredScope },
        requestId,
      });
      throw new ForbiddenError(
        'Access denied: Administrators cannot access identifiable clinical records.',
        'ACCESS_DENIED'
      );
    }

    // 3. Patients: Can read only their own records (and cannot generate AI clinician summaries)
    if (actorAccount.role === 'PATIENT') {
      const patientProfile = await this.identityRepo.getPatientByUserId(actorUserId);
      if (!patientProfile || patientProfile.id !== patientId) {
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'PATIENT',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'CROSS_PATIENT_ACCESS_FORBIDDEN',
          safeResourceRefs: {
            actorPatientId: patientProfile?.id ?? null,
            targetPatientId: patientId,
            requiredScope,
          },
          requestId,
        });
        throw new ForbiddenError(
          'Access denied: You cannot access clinical records belonging to another patient.',
          'ACCESS_DENIED'
        );
      }

      // Summary generation is clinician-only
      if (requiredScope === 'clinical-summary:generate') {
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'PATIENT',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'PATIENT_SUMMARY_GENERATE_FORBIDDEN',
          safeResourceRefs: { targetPatientId: patientId, requiredScope },
          requestId,
        });
        throw new ForbiddenError(
          'Access denied: Clinical summary generation requires clinician authorization.',
          'ACCESS_DENIED'
        );
      }

      const safeResourceRefs = {
        patientId: patientProfile.id,
        requiredScope,
        resourcePath,
        accessMode: 'PATIENT_SELF',
      };

      await this.auditService.recordEvent({
        actorUserId,
        actorRole: 'PATIENT',
        action: 'RECORD_ACCESS_CHECK',
        outcome: 'allowed',
        internalReasonCode: 'PATIENT_SELF_ACCESS_ALLOWED',
        safeResourceRefs,
        requestId,
      });

      return {
        authorized: true,
        accessMode: 'PATIENT_SELF',
        actorRole: 'PATIENT',
        actorId: patientProfile.id,
        patientId,
        scopes: ['timeline:read'],
        isEmergency: false,
        safeResourceRefs,
      };
    }

    // 4. Clinicians: Must be verified, have active grant, and active underlying consent (or emergency grant)
    if (actorAccount.role === 'CLINICIAN') {
      const clinicianProfile = await this.identityRepo.getClinicianByUserId(actorUserId);
      if (!clinicianProfile || !clinicianProfile.isVerified) {
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'CLINICIAN',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'CLINICIAN_NOT_VERIFIED',
          safeResourceRefs: {
            clinicianId: clinicianProfile?.id ?? null,
            targetPatientId: patientId,
            requiredScope,
          },
          requestId,
        });
        throw new ForbiddenError(
          'Access denied: Clinician is not verified.',
          'ACCESS_DENIED'
        );
      }

      // Explicit Access Grant header is mandatory
      if (!accessGrantId) {
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'CLINICIAN',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'MISSING_ACCESS_GRANT',
          safeResourceRefs: { clinicianId: clinicianProfile.id, targetPatientId: patientId },
          requestId,
        });
        throw new ForbiddenError(
          'Access denied: An active access grant is required.',
          'ACCESS_DENIED'
        );
      }

      // Fetch grant (check standard consent-backed grant first)
      const grant = await this.securityRepo.getAccessGrantById(accessGrantId);
      if (!grant) {
        // Check if accessGrantId corresponds to an active Emergency Access Grant
        const emergencyGrant = await this.securityRepo.getEmergencyAccessGrantById(accessGrantId);
        if (emergencyGrant) {
          // 1. Verify clinician eligibility: verified and has explicit server-provisioned emergency permission
          if (!clinicianProfile.hasEmergencyAccessPermission) {
            await this.auditService.recordEvent({
              actorUserId,
              actorRole: 'CLINICIAN',
              action: 'EMERGENCY_ACCESS_READ',
              outcome: 'denied',
              internalReasonCode: 'CLINICIAN_LACKS_EMERGENCY_PERMISSION',
              safeResourceRefs: {
                emergencyGrantId: emergencyGrant.id,
                clinicianId: clinicianProfile.id,
                patientId,
              },
              requestId,
            });
            throw new ForbiddenError(
              'Access denied: Clinician lacks explicit server-provisioned emergency break-glass permission.',
              'FORBIDDEN_EMERGENCY_ACCESS'
            );
          }

          // 2. Verify clinician matches
          if (emergencyGrant.clinicianId !== clinicianProfile.id) {
            await this.auditService.recordEvent({
              actorUserId,
              actorRole: 'CLINICIAN',
              action: 'EMERGENCY_ACCESS_READ',
              outcome: 'denied',
              internalReasonCode: 'EMERGENCY_GRANT_CLINICIAN_MISMATCH',
              safeResourceRefs: {
                emergencyGrantId: emergencyGrant.id,
                grantClinicianId: emergencyGrant.clinicianId,
                actorClinicianId: clinicianProfile.id,
              },
              requestId,
            });
            throw new ForbiddenError(
              'Access denied: Emergency grant belongs to a different clinician.',
              'ACCESS_DENIED'
            );
          }

          // 3. Verify target patient matches
          if (emergencyGrant.patientId !== patientId) {
            await this.auditService.recordEvent({
              actorUserId,
              actorRole: 'CLINICIAN',
              action: 'EMERGENCY_ACCESS_READ',
              outcome: 'denied',
              internalReasonCode: 'EMERGENCY_GRANT_PATIENT_MISMATCH',
              safeResourceRefs: {
                emergencyGrantId: emergencyGrant.id,
                grantPatientId: emergencyGrant.patientId,
                targetPatientId: patientId,
              },
              requestId,
            });
            throw new ForbiddenError(
              'Access denied: Emergency grant does not match requested patient.',
              'ACCESS_DENIED'
            );
          }

          const now = this.clock.now();

          // 4. Verify not expired and not revoked
          if (emergencyGrant.revokedAt !== null || now.getTime() >= emergencyGrant.expiresAt.getTime()) {
            await this.auditService.recordEvent({
              actorUserId,
              actorRole: 'CLINICIAN',
              action: 'EMERGENCY_ACCESS_READ',
              outcome: 'denied',
              internalReasonCode: 'EMERGENCY_GRANT_REVOKED_OR_EXPIRED',
              safeResourceRefs: {
                emergencyGrantId: emergencyGrant.id,
                revokedAt: emergencyGrant.revokedAt ? emergencyGrant.revokedAt.toISOString() : null,
                expiresAt: emergencyGrant.expiresAt.toISOString(),
              },
              requestId,
            });
            throw new ForbiddenError(
              'Access denied: Emergency access grant has expired or been revoked.',
              'ACCESS_DENIED'
            );
          }

          // 5. Verify scope: emergency only permits timeline:read (no AI summaries or bulk export)
          const isScopeAllowed =
            (emergencyGrant.scope === requiredScope || emergencyGrant.scopes.includes(requiredScope)) &&
            requiredScope === 'timeline:read';

          if (!isScopeAllowed) {
            await this.auditService.recordEvent({
              actorUserId,
              actorRole: 'CLINICIAN',
              action: 'EMERGENCY_ACCESS_READ',
              outcome: 'denied',
              internalReasonCode: 'EMERGENCY_SCOPE_NOT_GRANTED',
              safeResourceRefs: {
                emergencyGrantId: emergencyGrant.id,
                requiredScope,
                grantScope: emergencyGrant.scope,
              },
              requestId,
            });
            throw new ForbiddenError(
              `Access denied: Required scope '${requiredScope}' is not permitted under emergency override.`,
              'ACCESS_DENIED'
            );
          }

          // Explicit invariant: Emergency access strictly prohibits bulk download and export operations
          if (
            resourcePath === 'patient_record_export' ||
            resourcePath === 'patient_record_download' ||
            resourcePath.includes('export') ||
            resourcePath.includes('download')
          ) {
            await this.auditService.recordEvent({
              actorUserId,
              actorRole: 'CLINICIAN',
              action: 'EMERGENCY_ACCESS_READ',
              outcome: 'denied',
              internalReasonCode: 'EMERGENCY_BULK_EXPORT_FORBIDDEN',
              safeResourceRefs: {
                emergencyGrantId: emergencyGrant.id,
                resourcePath,
                patientId,
              },
              requestId,
            });
            throw new ForbiddenError(
              'Access denied: Record export and download are not permitted under emergency override.',
              'ACCESS_DENIED'
            );
          }

          // 6. Attributable safe audit logging for distinct emergency read (fails closed if audit fails)
          // CRITICAL: Reason text remains in protected DB storage and is NEVER output to operational audit logs
          const safeResourceRefs = {
            patientId,
            clinicianId: clinicianProfile.id,
            emergencyGrantId: emergencyGrant.id,
            requiredScope,
            resourcePath,
            accessMode: 'EMERGENCY_OVERRIDE',
          };

          await this.auditService.recordEvent({
            actorUserId,
            actorRole: 'CLINICIAN',
            action: 'EMERGENCY_ACCESS_READ',
            outcome: 'allowed',
            internalReasonCode: 'EMERGENCY_ACCESS_AUTHORIZED',
            safeResourceRefs,
            requestId,
          });

          return {
            authorized: true,
            accessMode: 'EMERGENCY_OVERRIDE',
            actorRole: 'CLINICIAN',
            actorId: clinicianProfile.id,
            patientId,
            grantId: emergencyGrant.id,
            scopes: [emergencyGrant.scope as Scope],
            isEmergency: true,
            safeResourceRefs,
          };
        }

        // Neither standard grant nor emergency grant found
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'CLINICIAN',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'ACCESS_GRANT_NOT_FOUND',
          safeResourceRefs: { attemptedGrantId: accessGrantId, targetPatientId: patientId },
          requestId,
        });
        throw new ForbiddenError('Access denied: Access grant not found.', 'ACCESS_DENIED');
      }

      // Verify grant belongs to THIS clinician
      if (grant.clinicianId !== clinicianProfile.id) {
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'CLINICIAN',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'GRANT_CLINICIAN_MISMATCH',
          safeResourceRefs: {
            grantId: grant.id,
            grantClinicianId: grant.clinicianId,
            actorClinicianId: clinicianProfile.id,
          },
          requestId,
        });
        throw new ForbiddenError(
          'Access denied: Access grant belongs to a different clinician.',
          'ACCESS_DENIED'
        );
      }

      // Verify grant is for THIS patient
      if (grant.patientId !== patientId) {
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'CLINICIAN',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'GRANT_PATIENT_MISMATCH',
          safeResourceRefs: {
            grantId: grant.id,
            grantPatientId: grant.patientId,
            targetPatientId: patientId,
          },
          requestId,
        });
        throw new ForbiddenError(
          'Access denied: Access grant does not match requested patient.',
          'ACCESS_DENIED'
        );
      }

      const now = this.clock.now();

      // Verify grant is unrevoked and unexpired
      if (grant.revokedAt !== null || now.getTime() >= grant.expiresAt.getTime()) {
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'CLINICIAN',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'GRANT_REVOKED_OR_EXPIRED',
          safeResourceRefs: {
            grantId: grant.id,
            revokedAt: grant.revokedAt ? grant.revokedAt.toISOString() : null,
            expiresAt: grant.expiresAt.toISOString(),
          },
          requestId,
        });
        throw new ForbiddenError(
          'Access denied: Access grant has expired or been revoked.',
          'ACCESS_DENIED'
        );
      }

      // Fetch and verify underlying consent
      const consent = await this.securityRepo.getConsentById(grant.consentId);
      if (
        !consent ||
        consent.status === 'revoked' ||
        consent.revokedAt !== null ||
        now.getTime() >= consent.expiresAt.getTime()
      ) {
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'CLINICIAN',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'UNDERLYING_CONSENT_REVOKED_OR_EXPIRED',
          safeResourceRefs: {
            grantId: grant.id,
            consentId: grant.consentId,
          },
          requestId,
        });
        throw new ForbiddenError(
          'Access denied: Underlying patient consent has expired or been revoked.',
          'ACCESS_DENIED'
        );
      }

      // Verify agreement between consent and grant
      if (consent.patientId !== grant.patientId || consent.clinicianId !== grant.clinicianId) {
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'CLINICIAN',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'CONSENT_GRANT_REFERENCE_MISMATCH',
          safeResourceRefs: { grantId: grant.id, consentId: consent.id },
          requestId,
        });
        throw new ForbiddenError(
          'Access denied: Consent and grant references do not agree.',
          'ACCESS_DENIED'
        );
      }

      // Verify required scope in BOTH grant and consent
      if (!grant.scopes.includes(requiredScope) || !consent.scopes.includes(requiredScope)) {
        await this.auditService.recordEvent({
          actorUserId,
          actorRole: 'CLINICIAN',
          action: 'RECORD_ACCESS_CHECK',
          outcome: 'denied',
          internalReasonCode: 'REQUIRED_SCOPE_NOT_GRANTED',
          safeResourceRefs: {
            grantId: grant.id,
            requiredScope,
            grantScopes: grant.scopes.join(','),
            consentScopes: consent.scopes.join(','),
          },
          requestId,
        });
        throw new ForbiddenError(
          `Access denied: Required scope '${requiredScope}' was not granted.`,
          'ACCESS_DENIED'
        );
      }

      // Audit release (Fail-closed: if audit write fails, clinical data is withheld)
      const safeResourceRefs = {
        patientId,
        clinicianId: clinicianProfile.id,
        grantId: grant.id,
        consentId: consent.id,
        requiredScope,
        resourcePath,
        accessMode: 'NORMAL_CONSENT',
      };

      await this.auditService.recordEvent({
        actorUserId,
        actorRole: 'CLINICIAN',
        action: 'RECORD_ACCESS_CHECK',
        outcome: 'allowed',
        internalReasonCode: 'CLINICIAN_AUTHORIZED',
        safeResourceRefs,
        requestId,
      });

      return {
        authorized: true,
        accessMode: 'NORMAL_CONSENT',
        actorRole: 'CLINICIAN',
        actorId: clinicianProfile.id,
        patientId,
        grantId: grant.id,
        scopes: grant.scopes,
        isEmergency: false,
        safeResourceRefs,
      };
    }

    // 5. Unknown role: fail closed
    throw new ForbiddenError('Access denied: Unknown role.', 'ACCESS_DENIED');
  }
}

/**
 * Express middleware factory for enforcing centralized patient access authorization.
 * Extracts `patientId` from request parameters and `accessGrantId` from X-Access-Grant-Id header.
 */
export function createAuthorizePatientAccessMiddleware(
  authorizer: AccessAuthorizer,
  requiredScope: Scope,
  optionsOrExtractor?:
    | ((req: Request) => string)
    | {
        patientIdExtractor?: (req: Request) => string;
        resourceName?: string;
      }
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const extractor =
        typeof optionsOrExtractor === 'function'
          ? optionsOrExtractor
          : optionsOrExtractor?.patientIdExtractor;
      const resourceName =
        typeof optionsOrExtractor === 'object' ? optionsOrExtractor.resourceName : undefined;

      const patientId = extractor
        ? extractor(req)
        : String(req.params.id || req.params.patientId || '');

      if (!patientId) {
        throw new ForbiddenError('Target patient identifier is missing.', 'ACCESS_DENIED');
      }

      const accessGrantId = req.headers['x-access-grant-id'] as string | undefined;

      const result = await authorizer.authorizePatientAccess({
        actorUserId: req.authContext!.userId,
        patientId,
        requiredScope,
        accessGrantId,
        requestId: req.id,
        resourcePath: resourceName ?? req.originalUrl ?? req.path,
      });

      req.accessResult = result;
      next();
    } catch (err) {
      next(err);
    }
  };
}
