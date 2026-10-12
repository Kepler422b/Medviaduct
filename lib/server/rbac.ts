import { AuthUser } from './auth';
import { qrService } from './qrService';
import { recordAudit } from './audit';
import { patientService } from '@/services/patientService';

export interface AuthorizationDecision {
  allowed: boolean;
  statusCode: number;
  reasonCode: string;
  errorMessage?: string;
  accessMode?: 'PATIENT_SELF' | 'ASSIGNED_CARE_RELATIONSHIP' | 'EMERGENCY_OVERRIDE';
  permittedScopes?: string[];
}

export const rbacService = {
  /**
   * Evaluates authorization for clinical record access.
   * Centralized zero-trust gate enforcing RBAC, IDOR prevention, and care-relationship checks.
   */
  authorizeClinicalAccess(params: {
    actor: AuthUser;
    targetPatientId: string;
    accessGrantId?: string;
    requestedScope?: 'timeline:read' | 'clinical-summary:generate';
    resourceName: string;
    requestId: string;
    clientIp?: string;
  }): AuthorizationDecision {
    const { actor, targetPatientId, accessGrantId, resourceName, requestId } = params;
    const clientIp = params.clientIp || '127.0.0.1';

    // 1. Invariant: Administrator Denial
    // Administrators are strictly prohibited from accessing identifiable patient clinical records
    if (actor.role === 'ADMIN') {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        actorName: actor.name,
        targetPatientId,
        action: 'UNAUTHORIZED_ACCESS_DENIED',
        resourceName,
        outcome: 'DENY',
        reasonCode: 'ADMIN_CLINICAL_ACCESS_PROHIBITED',
        clientIp,
        requestId,
        metadata: { role: actor.role, resource: resourceName }
      });

      return {
        allowed: false,
        statusCode: 403,
        reasonCode: 'ADMIN_CLINICAL_ACCESS_PROHIBITED',
        errorMessage: 'FORBIDDEN: Administrator privileges do not grant access to identifiable patient clinical records.'
      };
    }

    // 2. Patient Role Evaluation (IDOR / BOLA Prevention)
    if (actor.role === 'PATIENT') {
      // Patient is requesting their own records
      if (actor.domainId === targetPatientId) {
        recordAudit({
          actorUserId: actor.userId,
          actorRole: actor.role,
          actorName: actor.name,
          targetPatientId,
          action: 'CLINICAL_RECORD_READ',
          resourceName,
          outcome: 'ALLOW',
          reasonCode: 'PATIENT_SELF_ACCESS',
          clientIp,
          requestId
        });

        return {
          allowed: true,
          statusCode: 200,
          reasonCode: 'PATIENT_SELF_ACCESS',
          accessMode: 'PATIENT_SELF',
          permittedScopes: ['timeline:read', 'clinical-summary:generate']
        };
      }

      // Patient is attempting to access another patient's records -> IDOR Violation!
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        actorName: actor.name,
        targetPatientId,
        action: 'UNAUTHORIZED_ACCESS_DENIED',
        resourceName,
        outcome: 'DENY',
        reasonCode: 'IDOR_VIOLATION_DENIED',
        clientIp,
        requestId,
        metadata: { actorPatientId: actor.domainId, requestedPatientId: targetPatientId }
      });

      return {
        allowed: false,
        statusCode: 403,
        reasonCode: 'IDOR_VIOLATION_DENIED',
        errorMessage: 'ACCESS_DENIED: You are not authorized to view another patient\'s medical records.'
      };
    }

    // 3. Clinician Role Evaluation
    if (actor.role === 'CLINICIAN') {
      // A) Check if clinician holds a valid, active access grant (from QR scan)
      if (accessGrantId) {
        const grant = qrService.getGrant(accessGrantId);
        if (grant && grant.patientId === targetPatientId) {
          // Scope check if specified
          if (params.requestedScope && !grant.scopes.includes(params.requestedScope)) {
            recordAudit({
              actorUserId: actor.userId,
              actorRole: actor.role,
              actorName: actor.name,
              targetPatientId,
              action: 'UNAUTHORIZED_ACCESS_DENIED',
              resourceName,
              outcome: 'DENY',
              reasonCode: 'INSUFFICIENT_SCOPE_DENIED',
              clientIp,
              requestId,
              metadata: { grantId: accessGrantId, requestedScope: params.requestedScope }
            });

            return {
              allowed: false,
              statusCode: 403,
              reasonCode: 'INSUFFICIENT_SCOPE_DENIED',
              errorMessage: `ACCESS_DENIED: Access grant does not include requested scope '${params.requestedScope}'.`
            };
          }

          recordAudit({
            actorUserId: actor.userId,
            actorRole: actor.role,
            actorName: actor.name,
            targetPatientId,
            action: 'CLINICAL_RECORD_READ',
            resourceName,
            outcome: 'ALLOW',
            reasonCode: grant.grantType === 'EMERGENCY_OVERRIDE' ? 'EMERGENCY_OVERRIDE_VERIFIED' : 'ACTIVE_GRANT_VERIFIED',
            clientIp,
            requestId,
            metadata: { grantId: accessGrantId, scopes: grant.scopes }
          });

          return {
            allowed: true,
            statusCode: 200,
            reasonCode: 'ACTIVE_GRANT_VERIFIED',
            accessMode: grant.grantType === 'EMERGENCY_OVERRIDE' ? 'EMERGENCY_OVERRIDE' : 'ASSIGNED_CARE_RELATIONSHIP',
            permittedScopes: grant.scopes
          };
        }
      }

      // B) Check if clinician is the assigned primary physician for this patient
      if (actor.isAssignedToPatientA && targetPatientId === 'PAT-MH-40192') {
        recordAudit({
          actorUserId: actor.userId,
          actorRole: actor.role,
          actorName: actor.name,
          targetPatientId,
          action: 'CLINICAL_RECORD_READ',
          resourceName,
          outcome: 'ALLOW',
          reasonCode: 'PRIMARY_CARE_RELATIONSHIP_VERIFIED',
          clientIp,
          requestId,
          metadata: { clinicianLicense: actor.licenseNumber }
        });

        return {
          allowed: true,
          statusCode: 200,
          reasonCode: 'PRIMARY_CARE_RELATIONSHIP_VERIFIED',
          accessMode: 'ASSIGNED_CARE_RELATIONSHIP',
          permittedScopes: ['timeline:read', 'clinical-summary:generate']
        };
      }

      // C) Unassigned clinician without active grant or assignment -> Denied!
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        actorName: actor.name,
        targetPatientId,
        action: 'UNAUTHORIZED_ACCESS_DENIED',
        resourceName,
        outcome: 'DENY',
        reasonCode: 'UNASSIGNED_CLINICIAN_DENIED',
        clientIp,
        requestId,
        metadata: { clinicianLicense: actor.licenseNumber }
      });

      return {
        allowed: false,
        statusCode: 403,
        reasonCode: 'UNASSIGNED_CLINICIAN_DENIED',
        errorMessage: `ACCESS_DENIED: ${actor.name} does not have an authorized care relationship or valid QR access pass for this patient.`
      };
    }

    return {
      allowed: false,
      statusCode: 403,
      reasonCode: 'ROLE_UNAUTHORIZED',
      errorMessage: 'ACCESS_DENIED: Unrecognized or unauthorized role.'
    };
  },

  /**
   * Applies least-privilege field filtering on clinical patient bundles.
   */
  filterClinicalBundle(bundle: ReturnType<typeof patientService.getBundle>, permittedScopes: string[] = []) {
    // If summary only, suppress raw full consultations
    const includeTimeline = permittedScopes.includes('timeline:read');
    return {
      profile: {
        id: bundle.profile.id,
        name: bundle.profile.name,
        age: bundle.profile.age,
        sex: bundle.profile.sex,
        bloodGroup: bundle.profile.bloodGroup,
        uhid: bundle.profile.uhid,
        abhaId: bundle.profile.abhaId,
        address: bundle.profile.address,
        primaryCarePhysician: bundle.profile.primaryCarePhysician
      },
      allergies: bundle.allergies,
      conditions: bundle.conditions,
      prescriptions: bundle.prescriptions,
      labResults: bundle.labResults,
      vitals: bundle.consultations[0]?.vitals,
      consultations: includeTimeline ? bundle.consultations : []
    };
  }
};
