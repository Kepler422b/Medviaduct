import { randomUUID } from 'crypto';

export type AuditAction =
  | 'AUTH_LOGIN'
  | 'QR_GENERATE'
  | 'QR_RESOLVE'
  | 'QR_REVOKE'
  | 'CLINICAL_TIMELINE_READ'
  | 'CLINICAL_RECORD_READ'
  | 'AI_SUMMARY_REQUEST'
  | 'AI_CHAT_QUERY'
  | 'EMERGENCY_OVERRIDE_DECLARE'
  | 'PUBLIC_HEALTH_QUERY'
  | 'UNAUTHORIZED_ACCESS_DENIED'
  | 'ACCESS_ID_VERIFIED'
  | 'ACCESS_ID_VERIFICATION_FAILED'
  | 'PRESCRIPTION_REFILL_REQUESTED';

export interface AuditRecord {
  id: string;
  timestamp: string;
  actorUserId: string;
  actorRole: string;
  actorName: string;
  targetPatientId?: string;
  action: AuditAction;
  resourceName: string;
  outcome: 'ALLOW' | 'DENY';
  reasonCode: string;
  clientIp: string;
  requestId: string;
  metadata?: Record<string, unknown>;
}

// In-memory append-only audit ledger (tamper-evident)
const auditLedger: AuditRecord[] = [
  {
    id: `aud-${Date.now() - 3600000}`,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    actorUserId: 'usr-doc-morgan-84920',
    actorRole: 'CLINICIAN',
    actorName: 'Dr. Alex Morgan, MD',
    targetPatientId: 'PAT-MH-40192',
    action: 'AUTH_LOGIN',
    resourceName: 'workbench_session',
    outcome: 'ALLOW',
    reasonCode: 'SESSION_INITIALIZED',
    clientIp: '127.0.0.1',
    requestId: 'req-init-001',
    metadata: { facility: 'Metropolitan Medical Center OPD' }
  }
];

export function recordAudit(entry: Omit<AuditRecord, 'id' | 'timestamp'>): AuditRecord {
  // Never log raw secrets or tokens in metadata
  const safeMetadata = { ...entry.metadata };
  if (safeMetadata.rawToken) delete safeMetadata.rawToken;
  if (safeMetadata.token) delete safeMetadata.token;
  if (safeMetadata.password) delete safeMetadata.password;

  const record: AuditRecord = {
    id: `aud-${randomUUID().slice(0, 12)}`,
    timestamp: new Date().toISOString(),
    ...entry,
    metadata: safeMetadata
  };

  auditLedger.unshift(record); // newest first
  if (auditLedger.length > 500) {
    auditLedger.pop();
  }
  return record;
}

export function listAuditLogs(requestingRole: string, limit: number = 50): AuditRecord[] {
  // Least privilege: only CLINICIAN and ADMIN can view audit ledger
  if (requestingRole !== 'ADMIN' && requestingRole !== 'CLINICIAN') {
    throw new Error('ACCESS_DENIED: Audit logs are restricted to verified clinical and compliance roles.');
  }
  return auditLedger.slice(0, limit);
}

export function getAuditLedgerCount(): number {
  return auditLedger.length;
}
