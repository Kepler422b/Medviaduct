import {
  Clock,
  SystemClock,
  IdentityRepository,
  SecurityRepository,
} from '../contracts/interfaces.js';
import {
  CreateEmergencyAccessInput,
  CreateEmergencyAccessSchema,
  RevokeEmergencyAccessParamsSchema,
} from '../contracts/schemas.js';
import {
  EmergencyAccessResponse,
  SafeEmergencyGrantMetadata,
  Scope,
} from '../contracts/types.js';
import { AuditService } from '../audit/service.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../middleware/errorHandler.js';

export interface EmergencyAccessContext {
  userId: string;
  input: unknown;
  requestId: string;
}

export class EmergencyAccessService {
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
   * Declares emergency record access for a patient in acute medical need.
   *
   * SECURITY INVARIANTS:
   * 1. Only verified, active clinicians with explicit server-provisioned break-glass permission can declare.
   * 2. Administrators are strictly forbidden from emergency patient access.
   * 3. Reason code allowlist validated; meaningful bounded reason text (min 10, max 500 chars) required.
   * 4. Fixed scope 'timeline:read' only (no AI summaries or bulk export).
   * 5. Duration is strictly bounded to 5 minutes max, server-calculated.
   * 6. Fails closed if audit persistence fails.
   * 7. Reason text stored in protected storage; NEVER printed to operational audit logs.
   */
  async declareEmergencyAccess(context: EmergencyAccessContext): Promise<EmergencyAccessResponse> {
    const { userId, input, requestId } = context;

    // 1. Validate request body against strict Zod schema
    const parseResult = CreateEmergencyAccessSchema.safeParse(input);
    if (!parseResult.success) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: null,
        action: 'EMERGENCY_ACCESS_DECLARED',
        outcome: 'denied',
        internalReasonCode: 'SCHEMA_VALIDATION_FAILED',
        safeResourceRefs: { errors: parseResult.error.errors.map((e) => e.message).join('; ') },
        requestId,
      });
      throw new ValidationError(
        parseResult.error.errors.map((e) => e.message).join(', ')
      );
    }
    const data: CreateEmergencyAccessInput = parseResult.data;

    // 2. Resolve actor from trusted database
    const actorAccount = await this.identityRepo.getUserAccount(userId);
    if (!actorAccount || !actorAccount.isActive) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: null,
        action: 'EMERGENCY_ACCESS_DECLARED',
        outcome: 'denied',
        internalReasonCode: 'ACCOUNT_INACTIVE_OR_NOT_FOUND',
        safeResourceRefs: { targetPatientId: data.patientId },
        requestId,
      });
      throw new ForbiddenError(
        'Access denied: User account is inactive or not found.',
        'ACCESS_DENIED'
      );
    }

    // 3. Administrators are strictly forbidden from emergency patient access
    if (actorAccount.role === 'ADMIN') {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'ADMIN',
        action: 'EMERGENCY_ACCESS_DECLARED',
        outcome: 'denied',
        internalReasonCode: 'ADMIN_EMERGENCY_OVERRIDE_FORBIDDEN',
        safeResourceRefs: { targetPatientId: data.patientId },
        requestId,
      });
      throw new ForbiddenError(
        'Access denied: Administrators cannot declare emergency clinical access.',
        'FORBIDDEN_ROLE'
      );
    }

    // 4. Only CLINICIAN role is permitted
    if (actorAccount.role !== 'CLINICIAN') {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: actorAccount.role,
        action: 'EMERGENCY_ACCESS_DECLARED',
        outcome: 'denied',
        internalReasonCode: 'NON_CLINICIAN_EMERGENCY_OVERRIDE_FORBIDDEN',
        safeResourceRefs: { targetPatientId: data.patientId },
        requestId,
      });
      throw new ForbiddenError(
        'Access denied: Only licensed clinicians can declare emergency access.',
        'FORBIDDEN_ROLE'
      );
    }

    // 5. Clinician must be verified and have explicit server-provisioned emergency access permission
    const clinicianProfile = await this.identityRepo.getClinicianByUserId(userId);
    if (!clinicianProfile || !clinicianProfile.isVerified) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'EMERGENCY_ACCESS_DECLARED',
        outcome: 'denied',
        internalReasonCode: 'CLINICIAN_NOT_VERIFIED',
        safeResourceRefs: {
          clinicianId: clinicianProfile?.id ?? null,
          targetPatientId: data.patientId,
        },
        requestId,
      });
      throw new ForbiddenError(
        'Access denied: Unverified clinicians cannot declare emergency access.',
        'CLINICIAN_NOT_VERIFIED'
      );
    }

    if (!clinicianProfile.hasEmergencyAccessPermission) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'EMERGENCY_ACCESS_DECLARED',
        outcome: 'denied',
        internalReasonCode: 'CLINICIAN_LACKS_EMERGENCY_PERMISSION',
        safeResourceRefs: {
          clinicianId: clinicianProfile.id,
          targetPatientId: data.patientId,
        },
        requestId,
      });
      throw new ForbiddenError(
        'Access denied: Clinician lacks explicit server-provisioned emergency break-glass permission.',
        'FORBIDDEN_EMERGENCY_ACCESS'
      );
    }

    // 6. Verify target patient exists without leaking identifiable information on failure
    const patientProfile = await this.identityRepo.getPatientById(data.patientId);
    if (!patientProfile) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'CLINICIAN',
        action: 'EMERGENCY_ACCESS_DECLARED',
        outcome: 'denied',
        internalReasonCode: 'PATIENT_NOT_FOUND',
        safeResourceRefs: {
          clinicianId: clinicianProfile.id,
          targetPatientId: data.patientId,
        },
        requestId,
      });
      throw new NotFoundError('Target patient not found.', 'NOT_FOUND');
    }

    // 7. Calculate bounded emergency expiry: Default 5 minutes, Maximum 5 minutes, server-calculated
    const now = this.clock.now();
    const durationMinutes = 5;
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const reasonCode = data.reasonCode ?? 'IMMINENT_THREAT_TO_LIFE';
    const reasonText = (data.reasonText ?? data.justification)!.trim();
    const fixedScope = 'timeline:read';
    const scopes: Scope[] = ['timeline:read'];

    // 8. Create Emergency Access Grant in persistent database
    const grant = await this.securityRepo.createEmergencyAccessGrant({
      patientId: patientProfile.id,
      clinicianId: clinicianProfile.id,
      reasonCode,
      reasonText,
      justification: reasonText,
      scope: fixedScope,
      scopes,
      expiresAt,
      createdByUserId: userId,
      requestId,
    });

    // 9. Attributable safe audit logging (fails closed if audit write fails)
    // CRITICAL: reasonText is NOT logged to operational audit logs to protect clinical privacy
    await this.auditService.recordEvent({
      actorUserId: userId,
      actorRole: 'CLINICIAN',
      action: 'EMERGENCY_ACCESS_DECLARED',
      outcome: 'allowed',
      internalReasonCode: 'EMERGENCY_OVERRIDE_GRANTED',
      safeResourceRefs: {
        emergencyGrantId: grant.id,
        patientId: patientProfile.id,
        clinicianId: clinicianProfile.id,
        reasonCode,
        durationMinutes,
        expiresAt: expiresAt.toISOString(),
      },
      requestId,
    });

    const notice = `Emergency access — audited — expires at ${expiresAt.toISOString()}`;

    // Return only grant metadata after authorization
    return {
      emergencyGrantId: grant.id,
      id: grant.id,
      patientId: grant.patientId,
      clinicianId: grant.clinicianId,
      reasonCode: grant.reasonCode,
      reasonText: grant.reasonText,
      justification: grant.justification ?? grant.reasonText,
      scope: grant.scope,
      scopes: grant.scopes,
      createdAt: grant.createdAt.toISOString(),
      expiresAt: grant.expiresAt.toISOString(),
      notice,
    };
  }

  /**
   * Lists emergency grants.
   * - Patients see safe metadata for emergency access to their own records (without exposing another clinician's private justification).
   * - Clinicians see their own grant metadata.
   * - Administrators are denied.
   */
  async listEmergencyGrants(
    userId: string,
    requestId: string
  ): Promise<(EmergencyAccessResponse | SafeEmergencyGrantMetadata)[]> {
    const actorAccount = await this.identityRepo.getUserAccount(userId);
    if (!actorAccount || !actorAccount.isActive) {
      throw new ForbiddenError('Access denied: Inactive account.', 'ACCESS_DENIED');
    }

    if (actorAccount.role === 'ADMIN') {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: 'ADMIN',
        action: 'EMERGENCY_ACCESS_LIST',
        outcome: 'denied',
        internalReasonCode: 'ADMIN_EMERGENCY_LIST_FORBIDDEN',
        safeResourceRefs: {},
        requestId,
      });
      throw new ForbiddenError(
        'Access denied: Administrators cannot inspect clinical emergency grants.',
        'FORBIDDEN_ROLE'
      );
    }

    const now = this.clock.now();

    if (actorAccount.role === 'PATIENT') {
      const patientProfile = await this.identityRepo.getPatientByUserId(userId);
      if (!patientProfile) {
        throw new ForbiddenError('Patient profile required.', 'PATIENT_PROFILE_REQUIRED');
      }

      const grants = await this.securityRepo.getEmergencyAccessGrantsByPatientId(patientProfile.id);

      // Patients receive safe metadata: NO private clinician justification exposed through broad listings
      return grants.map((g) => {
        const isRevoked = g.revokedAt !== null;
        const isExpired = now.getTime() >= g.expiresAt.getTime();
        const effectiveStatus = isRevoked ? 'revoked' : isExpired ? 'expired' : 'active';
        return {
          id: g.id,
          emergencyGrantId: g.id,
          patientId: g.patientId,
          clinicianId: g.clinicianId,
          reasonCode: g.reasonCode,
          scope: g.scope,
          createdAt: g.createdAt.toISOString(),
          expiresAt: g.expiresAt.toISOString(),
          revokedAt: g.revokedAt ? g.revokedAt.toISOString() : null,
          effectiveStatus,
          notice: `Emergency access — audited — expires at ${g.expiresAt.toISOString()}`,
        };
      });
    }

    if (actorAccount.role === 'CLINICIAN') {
      const clinicianProfile = await this.identityRepo.getClinicianByUserId(userId);
      if (!clinicianProfile) {
        throw new ForbiddenError('Clinician profile required.', 'CLINICIAN_PROFILE_REQUIRED');
      }

      const grants = await this.securityRepo.getEmergencyAccessGrantsByClinicianId(clinicianProfile.id);

      return grants.map((g) => {
        const isRevoked = g.revokedAt !== null;
        const isExpired = now.getTime() >= g.expiresAt.getTime();
        const effectiveStatus = isRevoked ? 'revoked' : isExpired ? 'expired' : 'active';
        return {
          id: g.id,
          emergencyGrantId: g.id,
          patientId: g.patientId,
          clinicianId: g.clinicianId,
          reasonCode: g.reasonCode,
          reasonText: g.reasonText,
          justification: g.justification ?? g.reasonText,
          scope: g.scope,
          scopes: g.scopes,
          createdAt: g.createdAt.toISOString(),
          expiresAt: g.expiresAt.toISOString(),
          revokedAt: g.revokedAt ? g.revokedAt.toISOString() : null,
          effectiveStatus,
          notice: `Emergency access — audited — expires at ${g.expiresAt.toISOString()}`,
        };
      });
    }

    throw new ForbiddenError('Access denied.', 'ACCESS_DENIED');
  }

  /**
   * Revokes an active emergency access grant.
   * - Requesting clinician may close their own grant early.
   * - Patient may revoke an active emergency grant for their own record.
   * - Enforce ownership and make revocation idempotent.
   */
  async revokeEmergencyAccess(
    userId: string,
    grantId: string,
    requestId: string
  ): Promise<EmergencyAccessResponse> {
    const parseResult = RevokeEmergencyAccessParamsSchema.safeParse({ id: grantId });
    if (!parseResult.success) {
      throw new ValidationError('Invalid emergency grant ID.');
    }

    const grant = await this.securityRepo.getEmergencyAccessGrantById(grantId);
    if (!grant) {
      throw new NotFoundError('Emergency access grant not found.', 'NOT_FOUND');
    }

    const actorAccount = await this.identityRepo.getUserAccount(userId);
    if (!actorAccount || !actorAccount.isActive) {
      throw new ForbiddenError('Access denied: Inactive account.', 'ACCESS_DENIED');
    }

    // Must be either the clinician who declared it or the patient subject
    const clinicianProfile = await this.identityRepo.getClinicianByUserId(userId);
    const patientProfile = await this.identityRepo.getPatientByUserId(userId);

    const isOwningClinician = clinicianProfile && clinicianProfile.id === grant.clinicianId;
    const isSubjectPatient = patientProfile && patientProfile.id === grant.patientId;

    if (!isOwningClinician && !isSubjectPatient) {
      await this.auditService.recordEvent({
        actorUserId: userId,
        actorRole: actorAccount.role,
        action: 'EMERGENCY_ACCESS_REVOKED',
        outcome: 'denied',
        internalReasonCode: 'UNAUTHORIZED_REVOCATION_ATTEMPT',
        safeResourceRefs: { emergencyGrantId: grant.id },
        requestId,
      });
      throw new ForbiddenError(
        'Access denied: You are not authorized to revoke this emergency grant.',
        'ACCESS_DENIED'
      );
    }

    const now = this.clock.now();
    const revoked = await this.securityRepo.revokeEmergencyAccessGrant(grantId, now);
    const result = revoked ?? grant;

    // Audit with fallback allowed for revocation resilience
    await this.auditService.recordEvent(
      {
        actorUserId: userId,
        actorRole: actorAccount.role,
        action: 'EMERGENCY_ACCESS_REVOKED',
        outcome: 'allowed',
        internalReasonCode: 'EMERGENCY_GRANT_REVOKED',
        safeResourceRefs: { emergencyGrantId: grantId, patientId: grant.patientId },
        requestId,
      },
      true
    );

    return {
      emergencyGrantId: result.id,
      id: result.id,
      patientId: result.patientId,
      clinicianId: result.clinicianId,
      reasonCode: result.reasonCode,
      reasonText: result.reasonText,
      justification: result.justification ?? result.reasonText,
      scope: result.scope,
      scopes: result.scopes,
      createdAt: result.createdAt.toISOString(),
      expiresAt: result.expiresAt.toISOString(),
      revokedAt: (result.revokedAt ?? now).toISOString(),
      notice: `Emergency access revoked at ${(result.revokedAt ?? now).toISOString()}`,
    };
  }

  /**
   * Retrieves an emergency grant by ID (for verification/audit inspection).
   */
  async getEmergencyGrant(
    userId: string,
    grantId: string
  ): Promise<EmergencyAccessResponse | null> {
    const grant = await this.securityRepo.getEmergencyAccessGrantById(grantId);
    if (!grant) return null;

    const actorAccount = await this.identityRepo.getUserAccount(userId);
    if (!actorAccount) return null;

    return {
      emergencyGrantId: grant.id,
      id: grant.id,
      patientId: grant.patientId,
      clinicianId: grant.clinicianId,
      reasonCode: grant.reasonCode,
      reasonText: grant.reasonText,
      justification: grant.justification ?? grant.reasonText,
      scope: grant.scope,
      scopes: grant.scopes,
      createdAt: grant.createdAt.toISOString(),
      expiresAt: grant.expiresAt.toISOString(),
      revokedAt: grant.revokedAt ? grant.revokedAt.toISOString() : null,
      notice: `Emergency access — audited — expires at ${grant.expiresAt.toISOString()}`,
    };
  }
}
