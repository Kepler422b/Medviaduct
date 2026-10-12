/**
 * MediVault / Medviaduct - Member 3 Security Workstream
 * Core Security Contracts & Identifier Models
 *
 * CRITICAL IDENTIFIER SEPARATION:
 * 1. UserId: The account identifier (auth credential owner, e.g. UserAccount.id).
 * 2. PatientId: The domain clinical subject identifier (PatientProfile.id).
 * 3. ClinicianId: The domain practitioner identifier (ClinicianProfile.id).
 *
 * SECURITY INVARIANT:
 * A UserId is NOT interchangeable with a PatientId or ClinicianId.
 * An authenticated user acts ON BEHALF OF their associated profile only after
 * verified resolution via the trusted IdentityRepository.
 */

export type UserRole = 'PATIENT' | 'CLINICIAN' | 'ADMIN';

export type Scope = 'timeline:read' | 'clinical-summary:generate' | 'emergency:read';

export const SUPPORTED_SCOPES: readonly Scope[] = [
  'timeline:read',
  'clinical-summary:generate',
  'emergency:read',
] as const;

export type ConsentStatus = 'active' | 'revoked';
export type EffectiveConsentStatus = 'active' | 'revoked' | 'expired';

export interface UserAccountRecord {
  id: string; // UserId
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export interface PatientProfileRecord {
  id: string; // PatientId
  userId: string; // UserId foreign key
  mrn: string;
  createdAt: Date;
}

export const EMERGENCY_REASON_CODES = [
  'UNRESPONSIVE_TRAUMA',
  'ACUTE_CARDIOVASCULAR_COLLAPSE',
  'RESPIRATORY_ARREST',
  'SEVERE_SEPSIS_SHOCK',
  'ANAPHYLAXIS',
  'ACUTE_NEUROLOGICAL_DEFICIT',
  'IMMINENT_THREAT_TO_LIFE',
] as const;

export type EmergencyReasonCode = (typeof EMERGENCY_REASON_CODES)[number];

export interface ClinicianProfileRecord {
  id: string; // ClinicianId
  userId: string; // UserId foreign key
  licenseNumber: string;
  isVerified: boolean;
  verificationStatus: string;
  hasEmergencyAccessPermission: boolean;
  createdAt: Date;
}

export interface ConsentRecord {
  id: string;
  patientId: string;
  clinicianId: string;
  scopes: Scope[];
  status: ConsentStatus;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdByUserId: string;
}

export interface QrTokenRecord {
  id: string;
  consentId: string;
  tokenHash: string; // SHA-256 hash only. Raw token is NEVER stored.
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
}

export interface AccessGrantRecord {
  id: string;
  consentId: string;
  patientId: string;
  clinicianId: string;
  scopes: Scope[];
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface EmergencyAccessGrantRecord {
  id: string;
  patientId: string;
  clinicianId: string;
  reasonCode: string;
  reasonText: string;
  justification?: string | null;
  scope: string;
  scopes: Scope[];
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdByUserId: string;
  requestId: string;
}

export interface CreateEmergencyAccessParams {
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
}

export interface EmergencyAccessResponse {
  emergencyGrantId: string;
  id?: string;
  patientId: string;
  clinicianId: string;
  reasonCode: string;
  reasonText?: string;
  scope: string;
  scopes: Scope[];
  expiresAt: string;
  createdAt: string;
  revokedAt?: string | null;
  justification?: string;
  notice?: string;
}

export interface SafeEmergencyGrantMetadata {
  id: string;
  patientId: string;
  clinicianId: string;
  reasonCode: string;
  scope: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  effectiveStatus: 'active' | 'expired' | 'revoked';
  notice: string;
}

export type SuppressionStatus = 'available' | 'suppressed_unavailable';

export interface PermittedAggregateRecord {
  region: string;
  timeBucket: string;
  conditionCategory: string;
  caseCount: number | null; // NULL if suppressed, NOT ZERO!
  suppressionStatus: SuppressionStatus;
  thresholdApplied: number;
}

export interface AggregateQueryFilter {
  region?: string;
  startDate?: string;
  endDate?: string;
  conditionCategory?: string;
}

export type AuditOutcome = 'allowed' | 'denied';

export interface AuditEventRecord {
  id: string;
  timestamp: Date;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  outcome: AuditOutcome;
  internalReasonCode: string;
  safeResourceRefs: Record<string, string | number | boolean | null>;
  requestId: string;
}

export interface StandardErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface AuthenticatedUser {
  userId: string;
}

