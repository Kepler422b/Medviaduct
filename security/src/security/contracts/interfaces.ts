import type { Request } from 'express';
import {
  AuthenticatedUser,
  ConsentRecord,
  QrTokenRecord,
  AccessGrantRecord,
  AuditEventRecord,
  UserAccountRecord,
  PatientProfileRecord,
  ClinicianProfileRecord,
  Scope,
  EmergencyAccessGrantRecord,
  CreateEmergencyAccessParams,
} from './types.js';

export type { AuthenticatedUser };



export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/**
 * AuthenticationAdapter
 * Integration interface for Member 2 to bridge production session/token authentication.
 *
 * CRITICAL SECURITY INVARIANT:
 * Verifies the actual request session/token.
 * Returns only a trusted authenticated user ID.
 * Does NOT trust client-supplied role or identity headers.
 */
export interface AuthenticationAdapter {
  authenticate(req: Request): Promise<AuthenticatedUser | null>;
}

/**
 * IdentityRepository
 * Trusted source for user roles, verification, and profile linkages.
 */
export interface IdentityRepository {
  getUserAccount(userId: string): Promise<UserAccountRecord | null>;
  getPatientByUserId(userId: string): Promise<PatientProfileRecord | null>;
  getClinicianByUserId(userId: string): Promise<ClinicianProfileRecord | null>;
  getClinicianById(clinicianId: string): Promise<ClinicianProfileRecord | null>;
  getPatientById(patientId: string): Promise<PatientProfileRecord | null>;
  listAvailableClinicians?(): Promise<ClinicianProfileRecord[]>;
}

/**
 * SecurityRepository
 * Persistent storage for consents, QR tokens, access grants, and audit events.
 * Must support transactional and conditional atomic updates.
 */
export interface SecurityRepository {
  createConsent(params: {
    id?: string;
    patientId: string;
    clinicianId: string;
    scopes: Scope[];
    expiresAt: Date;
    createdByUserId: string;
  }): Promise<ConsentRecord>;

  getConsentById(id: string): Promise<ConsentRecord | null>;

  getConsentsByPatientId(patientId: string): Promise<ConsentRecord[]>;

  revokeConsentAndAssociatedGrants(
    consentId: string,
    revokedAt: Date
  ): Promise<ConsentRecord | null>;

  createQrToken(params: {
    id?: string;
    consentId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<QrTokenRecord>;

  findQrTokenByHash(tokenHash: string): Promise<QrTokenRecord | null>;

  invalidatePendingQrTokensForConsent(
    consentId: string,
    revokedAt: Date
  ): Promise<void>;

  consumeQrTokenAndCreateGrant(params: {
    qrTokenId: string;
    consentId: string;
    patientId: string;
    clinicianId: string;
    scopes: Scope[];
    grantExpiresAt: Date;
  }): Promise<AccessGrantRecord>;

  getAccessGrantById(id: string): Promise<AccessGrantRecord | null>;

  createEmergencyAccessGrant(params: {
    id?: string;
    patientId: string;
    clinicianId: string;
    reasonCode?: string;
    reasonText?: string;
    justification?: string;
    scope?: string;
    scopes?: Scope[];
    expiresAt: Date;
    createdByUserId?: string;
    requestId?: string;
  }): Promise<EmergencyAccessGrantRecord>;

  getEmergencyAccessGrantById(id: string): Promise<EmergencyAccessGrantRecord | null>;

  getEmergencyAccessGrantsByClinicianId(clinicianId: string): Promise<EmergencyAccessGrantRecord[]>;

  getEmergencyAccessGrantsByPatientId(patientId: string): Promise<EmergencyAccessGrantRecord[]>;

  revokeEmergencyAccessGrant(
    id: string,
    revokedAt: Date
  ): Promise<EmergencyAccessGrantRecord | null>;

  appendAuditEvent(event: Omit<AuditEventRecord, 'id'>): Promise<AuditEventRecord>;
}

export interface SecurityDependencies {
  authAdapter: AuthenticationAdapter;
  identityRepo: IdentityRepository;
  securityRepo: SecurityRepository;
  clock?: Clock;
}
