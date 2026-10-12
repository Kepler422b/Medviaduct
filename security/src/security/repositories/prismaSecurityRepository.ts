import { PrismaClient } from '@prisma/client';
import { SecurityRepository } from '../contracts/interfaces.js';
import {
  ConsentRecord,
  QrTokenRecord,
  AccessGrantRecord,
  EmergencyAccessGrantRecord,
  AuditEventRecord,
  Scope,
  ConsentStatus,
  AuditOutcome,
} from '../contracts/types.js';

export class PrismaSecurityRepository implements SecurityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createConsent(params: {
    id?: string;
    patientId: string;
    clinicianId: string;
    scopes: Scope[];
    expiresAt: Date;
    createdByUserId: string;
  }): Promise<ConsentRecord> {
    const consent = await this.prisma.consent.create({
      data: {
        id: params.id,
        patientId: params.patientId,
        clinicianId: params.clinicianId,
        scopes: params.scopes,
        status: 'active',
        expiresAt: params.expiresAt,
        createdByUserId: params.createdByUserId,
      },
    });

    return {
      id: consent.id,
      patientId: consent.patientId,
      clinicianId: consent.clinicianId,
      scopes: consent.scopes as Scope[],
      status: consent.status as ConsentStatus,
      createdAt: consent.createdAt,
      expiresAt: consent.expiresAt,
      revokedAt: consent.revokedAt,
      createdByUserId: consent.createdByUserId,
    };
  }

  async getConsentById(id: string): Promise<ConsentRecord | null> {
    const consent = await this.prisma.consent.findUnique({
      where: { id },
    });
    if (!consent) return null;

    return {
      id: consent.id,
      patientId: consent.patientId,
      clinicianId: consent.clinicianId,
      scopes: consent.scopes as Scope[],
      status: consent.status as ConsentStatus,
      createdAt: consent.createdAt,
      expiresAt: consent.expiresAt,
      revokedAt: consent.revokedAt,
      createdByUserId: consent.createdByUserId,
    };
  }

  async getConsentsByPatientId(patientId: string): Promise<ConsentRecord[]> {
    const consents = await this.prisma.consent.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });

    return consents.map((c) => ({
      id: c.id,
      patientId: c.patientId,
      clinicianId: c.clinicianId,
      scopes: c.scopes as Scope[],
      status: c.status as ConsentStatus,
      createdAt: c.createdAt,
      expiresAt: c.expiresAt,
      revokedAt: c.revokedAt,
      createdByUserId: c.createdByUserId,
    }));
  }

  async revokeConsentAndAssociatedGrants(
    consentId: string,
    revokedAt: Date
  ): Promise<ConsentRecord | null> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch current consent
      const existing = await tx.consent.findUnique({
        where: { id: consentId },
      });
      if (!existing) return null;

      // 2. Mark consent as revoked (idempotent if already revoked)
      const updatedConsent = await tx.consent.update({
        where: { id: consentId },
        data: {
          status: 'revoked',
          revokedAt: existing.revokedAt ?? revokedAt,
        },
      });

      // 3. Revoke any pending/unused QR tokens for this consent
      await tx.qrToken.updateMany({
        where: {
          consentId,
          consumedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      });

      // 4. Revoke all active access grants for this consent
      await tx.accessGrant.updateMany({
        where: {
          consentId,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      });

      return {
        id: updatedConsent.id,
        patientId: updatedConsent.patientId,
        clinicianId: updatedConsent.clinicianId,
        scopes: updatedConsent.scopes as Scope[],
        status: updatedConsent.status as ConsentStatus,
        createdAt: updatedConsent.createdAt,
        expiresAt: updatedConsent.expiresAt,
        revokedAt: updatedConsent.revokedAt,
        createdByUserId: updatedConsent.createdByUserId,
      };
    });
  }

  async createQrToken(params: {
    id?: string;
    consentId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<QrTokenRecord> {
    return await this.prisma.$transaction(async (tx) => {
      // Supersession rule: invalidate any previous unused tokens for the same consent
      await tx.qrToken.updateMany({
        where: {
          consentId: params.consentId,
          consumedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      // Create new QR token record
      const token = await tx.qrToken.create({
        data: {
          id: params.id,
          consentId: params.consentId,
          tokenHash: params.tokenHash,
          expiresAt: params.expiresAt,
        },
      });

      return {
        id: token.id,
        consentId: token.consentId,
        tokenHash: token.tokenHash,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        consumedAt: token.consumedAt,
        revokedAt: token.revokedAt,
      };
    });
  }

  async findQrTokenByHash(tokenHash: string): Promise<QrTokenRecord | null> {
    const token = await this.prisma.qrToken.findUnique({
      where: { tokenHash },
    });
    if (!token) return null;

    return {
      id: token.id,
      consentId: token.consentId,
      tokenHash: token.tokenHash,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      consumedAt: token.consumedAt,
      revokedAt: token.revokedAt,
    };
  }

  async invalidatePendingQrTokensForConsent(
    consentId: string,
    revokedAt: Date
  ): Promise<void> {
    await this.prisma.qrToken.updateMany({
      where: {
        consentId,
        consumedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });
  }

  async consumeQrTokenAndCreateGrant(params: {
    qrTokenId: string;
    consentId: string;
    patientId: string;
    clinicianId: string;
    scopes: Scope[];
    grantExpiresAt: Date;
  }): Promise<AccessGrantRecord> {
    return await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // Conditional atomic update to consume the token exactly once
      const updateResult = await tx.qrToken.updateMany({
        where: {
          id: params.qrTokenId,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          consumedAt: now,
        },
      });

      if (updateResult.count === 0) {
        throw new Error('TOKEN_UNAVAILABLE_OR_ALREADY_CONSUMED');
      }

      // Create the singular AccessGrant
      const grant = await tx.accessGrant.create({
        data: {
          consentId: params.consentId,
          patientId: params.patientId,
          clinicianId: params.clinicianId,
          scopes: params.scopes,
          expiresAt: params.grantExpiresAt,
        },
      });

      return {
        id: grant.id,
        consentId: grant.consentId,
        patientId: grant.patientId,
        clinicianId: grant.clinicianId,
        scopes: grant.scopes as Scope[],
        createdAt: grant.createdAt,
        expiresAt: grant.expiresAt,
        revokedAt: grant.revokedAt,
      };
    });
  }

  async getAccessGrantById(id: string): Promise<AccessGrantRecord | null> {
    const grant = await this.prisma.accessGrant.findUnique({
      where: { id },
    });
    if (!grant) return null;

    return {
      id: grant.id,
      consentId: grant.consentId,
      patientId: grant.patientId,
      clinicianId: grant.clinicianId,
      scopes: grant.scopes as Scope[],
      createdAt: grant.createdAt,
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
    };
  }

  async createEmergencyAccessGrant(params: {
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
  }): Promise<EmergencyAccessGrantRecord> {
    const reasonCode = params.reasonCode ?? 'IMMINENT_THREAT_TO_LIFE';
    const reasonText = params.reasonText ?? params.justification ?? '';
    const scope = params.scope ?? 'timeline:read';
    const scopes = params.scopes ?? ['timeline:read'];

    const grant = await this.prisma.emergencyAccessGrant.create({
      data: {
        id: params.id,
        patientId: params.patientId,
        clinicianId: params.clinicianId,
        reasonCode,
        reasonText,
        justification: params.justification ?? reasonText,
        scope,
        scopes,
        expiresAt: params.expiresAt,
        createdByUserId: params.createdByUserId ?? '',
        requestId: params.requestId ?? '',
      },
    });

    return {
      id: grant.id,
      patientId: grant.patientId,
      clinicianId: grant.clinicianId,
      reasonCode: grant.reasonCode,
      reasonText: grant.reasonText,
      justification: grant.justification,
      scope: grant.scope,
      scopes: grant.scopes as Scope[],
      createdAt: grant.createdAt,
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
      createdByUserId: grant.createdByUserId,
      requestId: grant.requestId,
    };
  }

  async getEmergencyAccessGrantById(id: string): Promise<EmergencyAccessGrantRecord | null> {
    const grant = await this.prisma.emergencyAccessGrant.findUnique({
      where: { id },
    });
    if (!grant) return null;

    return {
      id: grant.id,
      patientId: grant.patientId,
      clinicianId: grant.clinicianId,
      reasonCode: grant.reasonCode,
      reasonText: grant.reasonText,
      justification: grant.justification,
      scope: grant.scope,
      scopes: grant.scopes as Scope[],
      createdAt: grant.createdAt,
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
      createdByUserId: grant.createdByUserId,
      requestId: grant.requestId,
    };
  }

  async getEmergencyAccessGrantsByClinicianId(clinicianId: string): Promise<EmergencyAccessGrantRecord[]> {
    const grants = await this.prisma.emergencyAccessGrant.findMany({
      where: { clinicianId },
      orderBy: { createdAt: 'desc' },
    });

    return grants.map((g) => ({
      id: g.id,
      patientId: g.patientId,
      clinicianId: g.clinicianId,
      reasonCode: g.reasonCode,
      reasonText: g.reasonText,
      justification: g.justification,
      scope: g.scope,
      scopes: g.scopes as Scope[],
      createdAt: g.createdAt,
      expiresAt: g.expiresAt,
      revokedAt: g.revokedAt,
      createdByUserId: g.createdByUserId,
      requestId: g.requestId,
    }));
  }

  async getEmergencyAccessGrantsByPatientId(patientId: string): Promise<EmergencyAccessGrantRecord[]> {
    const grants = await this.prisma.emergencyAccessGrant.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });

    return grants.map((g) => ({
      id: g.id,
      patientId: g.patientId,
      clinicianId: g.clinicianId,
      reasonCode: g.reasonCode,
      reasonText: g.reasonText,
      justification: g.justification,
      scope: g.scope,
      scopes: g.scopes as Scope[],
      createdAt: g.createdAt,
      expiresAt: g.expiresAt,
      revokedAt: g.revokedAt,
      createdByUserId: g.createdByUserId,
      requestId: g.requestId,
    }));
  }

  async revokeEmergencyAccessGrant(
    id: string,
    revokedAt: Date
  ): Promise<EmergencyAccessGrantRecord | null> {
    const existing = await this.prisma.emergencyAccessGrant.findUnique({ where: { id } });
    if (!existing) return null;

    // Idempotent: preserve original revokedAt if already revoked
    const grant = await this.prisma.emergencyAccessGrant.update({
      where: { id },
      data: { revokedAt: existing.revokedAt ?? revokedAt },
    });

    return {
      id: grant.id,
      patientId: grant.patientId,
      clinicianId: grant.clinicianId,
      reasonCode: grant.reasonCode,
      reasonText: grant.reasonText,
      justification: grant.justification,
      scope: grant.scope,
      scopes: grant.scopes as Scope[],
      createdAt: grant.createdAt,
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
      createdByUserId: grant.createdByUserId,
      requestId: grant.requestId,
    };
  }

  async appendAuditEvent(event: Omit<AuditEventRecord, 'id'>): Promise<AuditEventRecord> {
    const row = await this.prisma.auditEvent.create({
      data: {
        timestamp: event.timestamp,
        actorUserId: event.actorUserId,
        actorRole: event.actorRole,
        action: event.action,
        outcome: event.outcome,
        internalReasonCode: event.internalReasonCode,
        safeResourceRefs: event.safeResourceRefs,
        requestId: event.requestId,
      },
    });

    return {
      id: row.id,
      timestamp: row.timestamp,
      actorUserId: row.actorUserId,
      actorRole: row.actorRole,
      action: row.action,
      outcome: row.outcome as AuditOutcome,
      internalReasonCode: row.internalReasonCode,
      safeResourceRefs: row.safeResourceRefs as Record<string, string | number | boolean | null>,
      requestId: row.requestId,
    };
  }
}
