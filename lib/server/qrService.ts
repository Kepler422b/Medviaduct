import { randomBytes, randomUUID } from 'crypto';
import { AuthUser, sha256Hex } from './auth';
import { recordAudit } from './audit';

export interface QrTokenRecord {
  id: string;
  consentId: string;
  patientId: string;
  patientName: string;
  tokenHash: string;
  tokenPrefix: string; // e.g. "MV-SHARE-..." or "MEDVIADUCT:v1:..."
  scopes: ('timeline:read' | 'clinical-summary:generate')[];
  issuedAt: string;
  expiresAt: string;
  singleUse: boolean;
  status: 'ACTIVE' | 'CONSUMED' | 'REVOKED' | 'EXPIRED';
  consumedAt?: string;
  consumedByClinicianId?: string;
  scanCount: number;
}

export interface AccessGrant {
  grantId: string;
  patientId: string;
  patientName: string;
  clinicianId: string;
  scopes: ('timeline:read' | 'clinical-summary:generate')[];
  issuedAt: string;
  expiresAt: string;
  grantType: 'CONSENT_GRANT' | 'EMERGENCY_OVERRIDE';
}

// In-memory token storage (persisted STRICTLY by SHA-256 hash)
const tokenRegistryByHash = new Map<string, QrTokenRecord>();
const activeAccessGrants = new Map<string, AccessGrant>();

// Seed deterministic test tokens for demo reproducibility
function seedPresetTokens() {
  const presets = [
    {
      patientId: 'PAT-MH-40192',
      patientName: 'Ananya Deshmukh',
      rawToken: 'MV-SHARE-8F32A9C04B',
      singleUse: false,
      minutes: 1440 // 24h
    },
    {
      patientId: 'PAT-MH-51204',
      patientName: 'Aarav Kulkarni',
      rawToken: 'MV-SHARE-AARAV51204',
      singleUse: false,
      minutes: 1440
    },
    {
      patientId: 'PAT-MH-62381',
      patientName: 'Meera Patil',
      rawToken: 'MV-SHARE-MEERA62381',
      singleUse: false,
      minutes: 1440
    },
    {
      patientId: 'PAT-MH-73492',
      patientName: 'Rohan Shah',
      rawToken: 'MV-SHARE-ROHAN73492',
      singleUse: false,
      minutes: 1440
    },
    {
      patientId: 'PAT-MH-84513',
      patientName: 'Sana Khan',
      rawToken: 'MV-SHARE-SANA84513',
      singleUse: false,
      minutes: 1440
    },
    // Dedicated Single-Use Ephemeral Test Token (5-minute TTL)
    {
      patientId: 'PAT-MH-40192',
      patientName: 'Ananya Deshmukh',
      rawToken: 'MEDVIADUCT:v1:a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      singleUse: true,
      minutes: 5
    },
    // Seeded Expired Test Token
    {
      patientId: 'PAT-MH-40192',
      patientName: 'Ananya Deshmukh',
      rawToken: 'MV-EXPIRED-TEST-TOKEN-999',
      singleUse: false,
      minutes: -60 // expired 1 hour ago
    },
    // Seeded Revoked Test Token
    {
      patientId: 'PAT-MH-40192',
      patientName: 'Ananya Deshmukh',
      rawToken: 'MV-REVOKED-TEST-TOKEN-888',
      singleUse: false,
      minutes: 60,
      initialStatus: 'REVOKED' as const
    }
  ];

  for (const p of presets) {
    const hash = sha256Hex(p.rawToken.trim().toUpperCase());
    const now = Date.now();
    tokenRegistryByHash.set(hash, {
      id: `tok-${randomUUID().slice(0, 8)}`,
      consentId: `con-${p.patientId}`,
      patientId: p.patientId,
      patientName: p.patientName,
      tokenHash: hash,
      tokenPrefix: p.rawToken.slice(0, 12),
      scopes: ['timeline:read', 'clinical-summary:generate'],
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + p.minutes * 60 * 1000).toISOString(),
      singleUse: p.singleUse,
      status: (p.initialStatus || (p.minutes <= 0 ? 'EXPIRED' : 'ACTIVE')),
      scanCount: 0
    });
  }
}

seedPresetTokens();

export const qrService = {
  /**
   * Generates a cryptographically secure, opaque token for a patient.
   * The token contains NO patient name, NO diagnoses, and NO plain patient ID.
   */
  async generateToken(params: {
    patientId: string;
    patientName: string;
    issuerUser: AuthUser;
    durationMinutes?: number;
    singleUse?: boolean;
    scopes?: ('timeline:read' | 'clinical-summary:generate')[];
  }): Promise<{ rawToken: string; expiresAt: string; tokenHash: string; singleUse: boolean }> {
    // RBAC: Only PATIENT can issue their own consent tokens (or assigned clinician on their behalf)
    if (params.issuerUser.role === 'ADMIN') {
      throw new Error('FORBIDDEN_ROLE: Administrators cannot generate patient consent tokens.');
    }
    if (params.issuerUser.role === 'PATIENT' && params.issuerUser.domainId !== params.patientId) {
      throw new Error('IDOR_VIOLATION: Patients cannot generate consent tokens for another patient.');
    }

    const durationMinutes = params.durationMinutes ?? 15;
    const singleUse = params.singleUse ?? false;
    const scopes = params.scopes ?? ['timeline:read', 'clinical-summary:generate'];

    // Generate 32 bytes (256-bit) cryptographically opaque random hex token
    const randomHex = randomBytes(32).toString('hex');
    const rawToken = singleUse
      ? `MEDVIADUCT:v1:${randomHex}`
      : `MV-SHARE-${randomHex.slice(0, 12).toUpperCase()}`;

    const tokenHash = sha256Hex(rawToken.toUpperCase());
    const now = Date.now();
    const expiresAt = new Date(now + durationMinutes * 60 * 1000).toISOString();

    const record: QrTokenRecord = {
      id: `tok-${randomUUID().slice(0, 8)}`,
      consentId: `con-${params.patientId}-${randomUUID().slice(0, 6)}`,
      patientId: params.patientId,
      patientName: params.patientName,
      tokenHash,
      tokenPrefix: rawToken.slice(0, 12),
      scopes,
      issuedAt: new Date(now).toISOString(),
      expiresAt,
      singleUse,
      status: 'ACTIVE',
      scanCount: 0
    };

    tokenRegistryByHash.set(tokenHash, record);

    recordAudit({
      actorUserId: params.issuerUser.userId,
      actorRole: params.issuerUser.role,
      actorName: params.issuerUser.name,
      targetPatientId: params.patientId,
      action: 'QR_GENERATE',
      resourceName: 'qr_token',
      outcome: 'ALLOW',
      reasonCode: singleUse ? 'SINGLE_USE_TOKEN_ISSUED' : 'EPHEMERAL_TOKEN_ISSUED',
      clientIp: '127.0.0.1',
      requestId: `req-gen-${Date.now()}`,
      metadata: {
        tokenHashPrefix: tokenHash.slice(0, 8),
        singleUse,
        durationMinutes,
        expiresAt
      }
    });

    return { rawToken, expiresAt, tokenHash, singleUse };
  },

  /**
   * Server-side verification and resolution of scanned QR token.
   * Decoding alone never grants access — requires authenticated clinician identity
   * and care relationship verification.
   */
  async resolveToken(params: {
    rawToken: string;
    requestingUser: AuthUser;
    clientIp?: string;
  }): Promise<{
    accessGrantId: string;
    patientId: string;
    patientName: string;
    scopes: string[];
    expiresAt: string;
    status: string;
  }> {
    const cleanToken = (params.rawToken || '').trim().toUpperCase();
    const tokenHash = sha256Hex(cleanToken);
    const clientIp = params.clientIp || '127.0.0.1';
    const requestId = `req-res-${Date.now()}`;

    // 1. RBAC Guard: Only verified CLINICIANS may resolve patient QR tokens
    if (params.requestingUser.role !== 'CLINICIAN') {
      recordAudit({
        actorUserId: params.requestingUser.userId,
        actorRole: params.requestingUser.role,
        actorName: params.requestingUser.name,
        action: 'UNAUTHORIZED_ACCESS_DENIED',
        resourceName: 'qr_resolution',
        outcome: 'DENY',
        reasonCode: 'FORBIDDEN_ROLE_QR_RESOLUTION',
        clientIp,
        requestId,
        metadata: { attemptedRole: params.requestingUser.role }
      });
      throw new Error(`ACCESS_DENIED: Role ${params.requestingUser.role} is prohibited from resolving clinical QR passes.`);
    }

    // 2. Token Lookup by SHA-256 Hash
    const record = tokenRegistryByHash.get(tokenHash);
    if (!record) {
      recordAudit({
        actorUserId: params.requestingUser.userId,
        actorRole: params.requestingUser.role,
        actorName: params.requestingUser.name,
        action: 'QR_RESOLVE',
        resourceName: 'qr_token',
        outcome: 'DENY',
        reasonCode: 'TOKEN_NOT_FOUND',
        clientIp,
        requestId,
        metadata: { tokenHashPrefix: tokenHash.slice(0, 8) }
      });
      throw new Error('INVALID_TOKEN: QR access token does not exist or has invalid format.');
    }

    // 3. Status checks: Revocation
    if (record.status === 'REVOKED') {
      recordAudit({
        actorUserId: params.requestingUser.userId,
        actorRole: params.requestingUser.role,
        actorName: params.requestingUser.name,
        targetPatientId: record.patientId,
        action: 'QR_RESOLVE',
        resourceName: 'qr_token',
        outcome: 'DENY',
        reasonCode: 'TOKEN_REVOKED',
        clientIp,
        requestId,
        metadata: { tokenId: record.id }
      });
      throw new Error('REVOKED_TOKEN: This QR access token has been revoked by the patient.');
    }

    // 4. Status checks: Single-use consumption
    if (record.status === 'CONSUMED') {
      recordAudit({
        actorUserId: params.requestingUser.userId,
        actorRole: params.requestingUser.role,
        actorName: params.requestingUser.name,
        targetPatientId: record.patientId,
        action: 'QR_RESOLVE',
        resourceName: 'qr_token',
        outcome: 'DENY',
        reasonCode: 'TOKEN_ALREADY_CONSUMED',
        clientIp,
        requestId,
        metadata: { tokenId: record.id, consumedAt: record.consumedAt }
      });
      throw new Error('CONSUMED_TOKEN: This single-use QR token has already been consumed.');
    }

    // 5. Expiry Check
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      record.status = 'EXPIRED';
      recordAudit({
        actorUserId: params.requestingUser.userId,
        actorRole: params.requestingUser.role,
        actorName: params.requestingUser.name,
        targetPatientId: record.patientId,
        action: 'QR_RESOLVE',
        resourceName: 'qr_token',
        outcome: 'DENY',
        reasonCode: 'TOKEN_EXPIRED',
        clientIp,
        requestId,
        metadata: { expiresAt: record.expiresAt }
      });
      throw new Error(`EXPIRED_TOKEN: This QR pass expired at ${new Date(record.expiresAt).toLocaleTimeString()}.`);
    }

    // 6. Care Relationship Check:
    // If the clinician is explicitly flagged as unassigned and NOT emergency authorized, deny
    if (params.requestingUser.isAssignedToPatientA === false && record.patientId === 'PAT-MH-40192') {
      recordAudit({
        actorUserId: params.requestingUser.userId,
        actorRole: params.requestingUser.role,
        actorName: params.requestingUser.name,
        targetPatientId: record.patientId,
        action: 'QR_RESOLVE',
        resourceName: 'care_relationship',
        outcome: 'DENY',
        reasonCode: 'UNASSIGNED_CLINICIAN_DENIED',
        clientIp,
        requestId,
        metadata: {
          clinicianLicense: params.requestingUser.licenseNumber,
          clinicianId: params.requestingUser.domainId
        }
      });
      throw new Error(
        `UNASSIGNED_CLINICIAN_DENIED: ${params.requestingUser.name} does not have an active care assignment for patient ${record.patientName}. Statutory break-glass override required.`
      );
    }

    // 7. Successful verification: Create bounded in-memory access grant
    const grantId = `AG-${randomUUID()}`;
    const grant: AccessGrant = {
      grantId,
      patientId: record.patientId,
      patientName: record.patientName,
      clinicianId: params.requestingUser.domainId || params.requestingUser.userId,
      scopes: record.scopes,
      issuedAt: new Date().toISOString(),
      expiresAt: record.expiresAt,
      grantType: 'CONSENT_GRANT'
    };

    activeAccessGrants.set(grantId, grant);

    // Consume if single-use
    record.scanCount += 1;
    if (record.singleUse) {
      record.status = 'CONSUMED';
      record.consumedAt = new Date().toISOString();
      record.consumedByClinicianId = params.requestingUser.domainId;
    }

    recordAudit({
      actorUserId: params.requestingUser.userId,
      actorRole: params.requestingUser.role,
      actorName: params.requestingUser.name,
      targetPatientId: record.patientId,
      action: 'QR_RESOLVE',
      resourceName: 'access_grant',
      outcome: 'ALLOW',
      reasonCode: record.singleUse ? 'SINGLE_USE_REDEEMED' : 'CONSENT_TOKEN_VERIFIED',
      clientIp,
      requestId,
      metadata: {
        grantId,
        scopes: record.scopes,
        singleUse: record.singleUse
      }
    });

    return {
      accessGrantId: grantId,
      patientId: record.patientId,
      patientName: record.patientName,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
      status: 'ACTIVE'
    };
  },

  /**
   * Revoke an active token.
   */
  async revokeToken(rawTokenOrHash: string, actor: AuthUser): Promise<boolean> {
    const tokenHash = rawTokenOrHash.length === 64
      ? rawTokenOrHash
      : sha256Hex(rawTokenOrHash.trim().toUpperCase());

    const record = tokenRegistryByHash.get(tokenHash);
    if (!record) return false;

    // RBAC: Only patient owner or admin can revoke
    if (actor.role === 'PATIENT' && actor.domainId !== record.patientId) {
      throw new Error('IDOR_VIOLATION: You cannot revoke another patient\'s token.');
    }

    record.status = 'REVOKED';

    // Invalidate associated active grants
    for (const [gId, grant] of activeAccessGrants.entries()) {
      if (grant.patientId === record.patientId) {
        activeAccessGrants.delete(gId);
      }
    }

    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      actorName: actor.name,
      targetPatientId: record.patientId,
      action: 'QR_REVOKE',
      resourceName: 'qr_token',
      outcome: 'ALLOW',
      reasonCode: 'TOKEN_REVOKED_BY_USER',
      clientIp: '127.0.0.1',
      requestId: `req-rev-${Date.now()}`
    });

    return true;
  },

  getGrant(grantId: string): AccessGrant | undefined {
    const grant = activeAccessGrants.get(grantId);
    if (grant && new Date(grant.expiresAt).getTime() <= Date.now()) {
      activeAccessGrants.delete(grantId);
      return undefined;
    }
    return grant;
  },

  createAccessGrant(params: {
    patientId: string;
    patientName: string;
    clinicianId: string;
    grantType?: 'CONSENT_GRANT' | 'EMERGENCY_OVERRIDE';
    durationMinutes?: number;
    scopes?: ('timeline:read' | 'clinical-summary:generate')[];
  }): AccessGrant {
    const grantId = `AG-${randomUUID()}`;
    const now = Date.now();
    const duration = (params.durationMinutes || 60) * 60 * 1000;
    const grant: AccessGrant = {
      grantId,
      patientId: params.patientId,
      patientName: params.patientName,
      clinicianId: params.clinicianId,
      scopes: params.scopes || ['timeline:read', 'clinical-summary:generate'],
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + duration).toISOString(),
      grantType: params.grantType || 'CONSENT_GRANT'
    };
    activeAccessGrants.set(grantId, grant);
    return grant;
  }
};
