import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/host/app.js';
import { TestClock, TestAuthAdapter, resetDatabase } from './testHarness.js';
import { FIXTURES } from '../src/security/contracts/fixtures.js';
import { PrismaSecurityRepository } from '../src/security/repositories/prismaSecurityRepository.js';
import { PrismaIdentityRepository } from '../src/security/repositories/prismaIdentityRepository.js';
import { ClinicalSummarySecurityWrapper } from '../src/security/access/member4Wrapper.js';
import { AuditService } from '../src/security/audit/service.js';
import { hashToken } from '../src/security/qr/service.js';
import {
  evaluateGroupEligibility,
  applyComplementarySuppression,
  validateApprovedModelInputs,
  authorizeAggregateAccess,
} from '../src/security/privacy/modelInputContract.js';
import { MediVaultSecurityClient } from '../src/security/client/apiHelpers.js';

describe('MediVault / Medviaduct - Member 3 Security Workstream Tests', () => {
  const prisma = new PrismaClient();
  let testClock: TestClock;
  let testAuthAdapter: TestAuthAdapter;
  let securityRepo: PrismaSecurityRepository;
  let identityRepo: PrismaIdentityRepository;
  let appInstance: ReturnType<typeof createApp>;

  beforeEach(async () => {
    testClock = new TestClock(new Date('2026-10-10T12:00:00.000Z'));
    testAuthAdapter = new TestAuthAdapter();
    securityRepo = new PrismaSecurityRepository(prisma);
    identityRepo = new PrismaIdentityRepository(prisma);

    await resetDatabase(prisma);

    appInstance = createApp(
      {
        authAdapter: testAuthAdapter,
        identityRepo,
        securityRepo,
        clock: testClock,
      },
      prisma
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // Case 1: Successful consent -> QR -> grant -> authorized timeline
  // =========================================================================
  it('Case 1: Successful consent -> QR -> grant -> authorized timeline', async () => {
    // 1. Patient A creates consent for Clinician A
    const consentRes = await request(appInstance.app)
      .post('/api/consents')
      .set('Authorization', 'Bearer patient-a-token')
      .send({
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read', 'clinical-summary:generate'],
        durationMinutes: 30,
      });

    expect(consentRes.status).toBe(201);
    expect(consentRes.body.id).toBeDefined();
    expect(consentRes.body.patientId).toBe(FIXTURES.PATIENT_A.patientId);
    expect(consentRes.body.effectiveStatus).toBe('active');
    const consentId = consentRes.body.id;

    // 2. Patient A generates single-use QR token
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId });

    expect(qrRes.status).toBe(200);
    expect(qrRes.body.payload).toMatch(/^MEDVIADUCT:v1:[a-f0-9]{64}$/);
    const token = qrRes.body.payload;

    // 3. Clinician A resolves QR token into an Access Grant
    const resolveRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.accessGrantId).toBeDefined();
    expect(resolveRes.body.patientId).toBe(FIXTURES.PATIENT_A.patientId);
    expect(resolveRes.body.scopes).toContain('timeline:read');
    const accessGrantId = resolveRes.body.accessGrantId;

    // 4. Clinician A accesses Patient A timeline with grant
    const timelineRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', accessGrantId);

    expect(timelineRes.status).toBe(200);
    expect(timelineRes.body.patientId).toBe(FIXTURES.PATIENT_A.patientId);
    expect(timelineRes.body.timelineEvents).toBeDefined();
    expect(timelineRes.body.accessAudit.authorizedRole).toBe('CLINICIAN');
  });

  // =========================================================================
  // Case 2: Missing/invalid authentication
  // =========================================================================
  it('Case 2: Missing/invalid authentication', async () => {
    // No Authorization header
    const noAuthRes = await request(appInstance.app)
      .post('/api/consents')
      .send({
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
      });

    expect(noAuthRes.status).toBe(401);
    expect(noAuthRes.body.error.code).toBe('UNAUTHENTICATED');

    // Invalid bearer token
    const invalidAuthRes = await request(appInstance.app)
      .post('/api/consents')
      .set('Authorization', 'Bearer forged-invalid-token')
      .send({
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
      });

    expect(invalidAuthRes.status).toBe(401);
    expect(invalidAuthRes.body.error.code).toBe('UNAUTHENTICATED');
  });

  // =========================================================================
  // Case 3: Administrator QR denial
  // =========================================================================
  it('Case 3: Administrator QR denial', async () => {
    // Generate valid QR for Patient A
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    // Administrator attempts to resolve QR token
    const adminResolveRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer admin-token')
      .send({ token: qrRes.body.payload });

    expect(adminResolveRes.status).toBe(403);
    expect(adminResolveRes.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  // =========================================================================
  // Case 4: Unverified/inactive clinician denial
  // =========================================================================
  it('Case 4: Unverified/inactive clinician denial', async () => {
    // Consent created for Clinician A
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    // Unverified clinician attempts resolution
    const unverifiedRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-unverified-token')
      .send({ token: qrRes.body.payload });

    expect(unverifiedRes.status).toBe(403);
    expect(unverifiedRes.body.error.code).toBe('ACCESS_DENIED');

    // Attempting to create consent for unverified clinician also fails
    const createConsentRes = await request(appInstance.app)
      .post('/api/consents')
      .set('Authorization', 'Bearer patient-a-token')
      .send({
        clinicianId: FIXTURES.CLINICIAN_UNVERIFIED.clinicianId,
        scopes: ['timeline:read'],
      });

    expect(createConsentRes.status).toBe(403);
    expect(createConsentRes.body.error.code).toBe('CLINICIAN_NOT_VERIFIED');
  });

  // =========================================================================
  // Case 5: Wrong clinician denial
  // =========================================================================
  it('Case 5: Wrong clinician denial', async () => {
    // Consent is specifically for Clinician A
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    // Clinician B (verified, but NOT named in the consent) attempts resolution
    const wrongClinicianRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-b-token')
      .send({ token: qrRes.body.payload });

    expect(wrongClinicianRes.status).toBe(403);
    expect(wrongClinicianRes.body.error.code).toBe('QR_ACCESS_UNAVAILABLE');
  });

  // =========================================================================
  // Case 6: Failed resolution leaves valid QR usable
  // =========================================================================
  it('Case 6: Failed resolution leaves valid QR usable', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    const rawPayload = qrRes.body.payload;

    // Unauthorized attempt by Clinician B fails
    const failRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-b-token')
      .send({ token: rawPayload });
    expect(failRes.status).toBe(403);

    // Intended Clinician A resolves the STILL VALID token successfully
    const successRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token: rawPayload });

    expect(successRes.status).toBe(200);
    expect(successRes.body.accessGrantId).toBeDefined();
  });

  // =========================================================================
  // Case 7: Invalid/expired/revoked/consumed QR denial
  // =========================================================================
  it('Case 7: Invalid/expired/revoked/consumed QR denial', async () => {
    // 1. Non-existent / invalid token
    const invalidRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token: 'MEDVIADUCT:v1:0000000000000000000000000000000000000000000000000000000000000000' });
    expect(invalidRes.status).toBe(403);
    expect(invalidRes.body.error.code).toBe('QR_ACCESS_UNAVAILABLE');

    // 2. Consume a token, then test replay
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    const token = qrRes.body.payload;
    const firstResolve = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token });
    expect(firstResolve.status).toBe(200);

    // Replay attempt fails
    const replayResolve = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token });
    expect(replayResolve.status).toBe(403);
    expect(replayResolve.body.error.code).toBe('QR_ACCESS_UNAVAILABLE');

    // 3. Expired QR token
    const qr2 = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    // Advance clock past 5-minute QR lifetime
    testClock.advanceMinutes(6);

    const expiredResolve = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token: qr2.body.payload });
    expect(expiredResolve.status).toBe(403);
    expect(expiredResolve.body.error.code).toBe('QR_ACCESS_UNAVAILABLE');
  });

  // =========================================================================
  // Case 8: Concurrent resolution produces at most one grant
  // =========================================================================
  it('Case 8: Concurrent resolution produces at most one grant', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    const token = qrRes.body.payload;

    // Fire 5 simultaneous resolution requests
    const promises = Array.from({ length: 5 }, () =>
      request(appInstance.app)
        .post('/api/qr/resolve')
        .set('Authorization', 'Bearer clinician-a-token')
        .send({ token })
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.status === 200).length;
    const failureCount = results.filter((r) => r.status === 403).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(4);

    // Verify exactly 1 grant in persistent storage
    const grants = await prisma.accessGrant.findMany({
      where: { consentId: consent.id },
    });
    expect(grants.length).toBe(1);
  });

  // =========================================================================
  // Case 9: Cross-patient consent generation/revocation denial
  // =========================================================================
  it('Case 9: Cross-patient consent generation/revocation denial', async () => {
    // Patient A creates consent
    const consentA = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });

    // Patient B attempts to generate QR for Patient A's consent
    const crossQrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-b-token')
      .send({ consentId: consentA.id });
    expect(crossQrRes.status).toBe(404);
    expect(crossQrRes.body.error.code).toBe('CONSENT_NOT_FOUND');

    // Patient B attempts to revoke Patient A's consent
    const crossRevokeRes = await request(appInstance.app)
      .post(`/api/consents/${consentA.id}/revoke`)
      .set('Authorization', 'Bearer patient-b-token');
    expect(crossRevokeRes.status).toBe(404);
    expect(crossRevokeRes.body.error.code).toBe('CONSENT_NOT_FOUND');

    // Verify Patient A's consent remains active
    const checkConsent = await securityRepo.getConsentById(consentA.id);
    expect(checkConsent?.status).toBe('active');
  });

  // =========================================================================
  // Case 10: Direct patient request without grant denial
  // =========================================================================
  it('Case 10: Direct patient request without grant denial', async () => {
    // Clinician A queries Patient A timeline directly without X-Access-Grant-Id
    const directRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token');

    expect(directRes.status).toBe(403);
    expect(directRes.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 11: Grant cannot access another patient
  // =========================================================================
  it('Case 11: Grant cannot access another patient', async () => {
    // Create grant for Patient A
    const consentA = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const grant = await prisma.accessGrant.create({
      data: {
        consentId: consentA.id,
        patientId: FIXTURES.PATIENT_A.patientId,
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
        expiresAt: new Date(testClock.now().getTime() + 15 * 60 * 1000),
      },
    });

    // Clinician A attempts to use Patient A's grant to access Patient B
    const crossAccessRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_B.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grant.id);

    expect(crossAccessRes.status).toBe(403);
    expect(crossAccessRes.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 12: Grant cannot be reused by another clinician
  // =========================================================================
  it('Case 12: Grant cannot be reused by another clinician', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const grant = await prisma.accessGrant.create({
      data: {
        consentId: consent.id,
        patientId: FIXTURES.PATIENT_A.patientId,
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
        expiresAt: new Date(testClock.now().getTime() + 15 * 60 * 1000),
      },
    });

    // Clinician B attempts to use Clinician A's grant
    const reuseRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-b-token')
      .set('X-Access-Grant-Id', grant.id);

    expect(reuseRes.status).toBe(403);
    expect(reuseRes.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 13: Grant expiry
  // =========================================================================
  it('Case 13: Grant expiry', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 60 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const grant = await prisma.accessGrant.create({
      data: {
        consentId: consent.id,
        patientId: FIXTURES.PATIENT_A.patientId,
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
        expiresAt: new Date(testClock.now().getTime() + 15 * 60 * 1000),
      },
    });

    // Advance clock past grant lifetime (16 minutes)
    testClock.advanceMinutes(16);

    const expiredRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grant.id);

    expect(expiredRes.status).toBe(403);
    expect(expiredRes.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 14: Consent expiry invalidates existing grant
  // =========================================================================
  it('Case 14: Consent expiry invalidates existing grant', async () => {
    // Consent expires in 10 minutes, grant set for 15 minutes
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 10 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const grant = await prisma.accessGrant.create({
      data: {
        consentId: consent.id,
        patientId: FIXTURES.PATIENT_A.patientId,
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
        expiresAt: new Date(testClock.now().getTime() + 15 * 60 * 1000),
      },
    });

    // Advance clock 11 minutes (consent expired, though grant unexpired)
    testClock.advanceMinutes(11);

    const res = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grant.id);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 15: Consent revocation invalidates existing grant
  // =========================================================================
  it('Case 15: Consent revocation invalidates existing grant', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const grant = await prisma.accessGrant.create({
      data: {
        consentId: consent.id,
        patientId: FIXTURES.PATIENT_A.patientId,
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
        expiresAt: new Date(testClock.now().getTime() + 15 * 60 * 1000),
      },
    });

    // Patient A revokes consent
    const revokeRes = await request(appInstance.app)
      .post(`/api/consents/${consent.id}/revoke`)
      .set('Authorization', 'Bearer patient-a-token');
    expect(revokeRes.status).toBe(200);

    // Clinician attempt with existing grant fails immediately
    const res = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grant.id);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 16: Required scope enforcement
  // =========================================================================
  it('Case 16: Required scope enforcement', async () => {
    // Consent and grant created with only 'timeline:read'
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const grant = await prisma.accessGrant.create({
      data: {
        consentId: consent.id,
        patientId: FIXTURES.PATIENT_A.patientId,
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
        expiresAt: new Date(testClock.now().getTime() + 15 * 60 * 1000),
      },
    });

    // Attempting clinical-summary:generate scope fails
    await expect(
      appInstance.securityModule.authorizer.authorizePatientAccess({
        actorUserId: FIXTURES.CLINICIAN_A.userId,
        patientId: FIXTURES.PATIENT_A.patientId,
        requiredScope: 'clinical-summary:generate',
        accessGrantId: grant.id,
      })
    ).rejects.toThrow('Required scope');
  });

  // =========================================================================
  // Case 17: Administrator timeline/summary denial where routes exist
  // =========================================================================
  it('Case 17: Administrator timeline/summary denial where routes exist', async () => {
    const adminTimelineRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer admin-token');

    expect(adminTimelineRes.status).toBe(403);
    expect(adminTimelineRes.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 18: Forged role/verification/ownership fields fail
  // =========================================================================
  it('Case 18: Forged role/verification/ownership fields fail', async () => {
    // Patient attempts to supply forged headers and extra body fields
    const forgedRes = await request(appInstance.app)
      .post('/api/consents')
      .set('Authorization', 'Bearer patient-a-token')
      .set('X-User-Role', 'ADMIN')
      .set('X-Patient-Id', FIXTURES.PATIENT_B.patientId)
      .send({
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
        patientId: FIXTURES.PATIENT_B.patientId, // Injected foreign patientId
        isVerified: true,
      });

    // Zod strict schema rejects unknown/elevated fields immediately
    expect(forgedRes.status).toBe(400);
    expect(forgedRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  // =========================================================================
  // Case 19: Safe allowed/denied audit events
  // =========================================================================
  it('Case 19: Safe allowed/denied audit events', async () => {
    // Generate an allowed event and a denied event
    await request(appInstance.app)
      .post('/api/consents')
      .set('Authorization', 'Bearer patient-a-token')
      .send({
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
      });

    await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_B.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token');

    const events = await prisma.auditEvent.findMany();
    expect(events.length).toBeGreaterThanOrEqual(2);

    for (const evt of events) {
      expect(evt.timestamp).toBeDefined();
      expect(evt.action).toBeDefined();
      expect(['allowed', 'denied']).toContain(evt.outcome);
      expect(evt.requestId).toBeDefined();

      // Ensure NO sensitive tokens or medical diagnoses are present in safeResourceRefs
      const refStr = JSON.stringify(evt.safeResourceRefs);
      expect(refStr).not.toContain('MEDVIADUCT');
      expect(refStr).not.toContain('diagnosis');
      expect(refStr).not.toContain('prescription');
    }
  });

  // =========================================================================
  // Case 20: QR payload contains no patient information
  // =========================================================================
  it('Case 20: QR payload contains no patient information', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    const payload = qrRes.body.payload;
    expect(payload).not.toContain(FIXTURES.PATIENT_A.patientId);
    expect(payload).not.toContain(FIXTURES.PATIENT_A.userId);
    expect(payload).not.toContain(FIXTURES.PATIENT_A.mrn);
    expect(payload).not.toContain(FIXTURES.PATIENT_A.email);
    expect(payload).toMatch(/^MEDVIADUCT:v1:[a-f0-9]{64}$/);
  });

  // =========================================================================
  // Case 21: Raw QR token absent from storage and logs
  // =========================================================================
  it('Case 21: Raw QR token absent from storage and logs', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    const rawToken = qrRes.body.payload.replace('MEDVIADUCT:v1:', '');

    // Check database qr_tokens table
    const storedTokens = await prisma.qrToken.findMany({
      where: { consentId: consent.id },
    });
    expect(storedTokens.length).toBe(1);
    expect(storedTokens[0].tokenHash).not.toBe(rawToken);
    expect(storedTokens[0].tokenHash).toBe(hashToken(rawToken));
  });

  // =========================================================================
  // Case 22: No-store headers
  // =========================================================================
  it('Case 22: No-store headers', async () => {
    const res = await request(appInstance.app)
      .get('/api/health');

    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.headers['expires']).toBe('0');
  });

  // =========================================================================
  // Case 23: Rate limits
  // =========================================================================
  it('Case 23: Rate limits', async () => {
    // Instantiate test app with tight rate limit threshold of 3 requests per minute
    const rateLimitedApp = createApp({
      authAdapter: testAuthAdapter,
      identityRepo,
      securityRepo,
      clock: testClock,
    }).app;

    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });

    // Rapid successive requests
    let lastStatus = 200;
    for (let i = 0; i < 35; i++) {
      const res = await request(rateLimitedApp)
        .post('/api/qr/generate')
        .set('Authorization', 'Bearer patient-a-token')
        .send({ consentId: consent.id });
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }

    expect(lastStatus).toBe(429);
  });

  // =========================================================================
  // Case 24: Audit outage blocks grants and clinical release
  // =========================================================================
  it('Case 24: Audit outage blocks grants and clinical release', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    // Mock audit failure in securityRepo
    const failingSecurityRepo = Object.create(securityRepo);
    failingSecurityRepo.appendAuditEvent = async () => {
      throw new Error('Database audit partition disk full');
    };

    const failingAuditService = new AuditService(failingSecurityRepo);
    const { QrService } = await import('../src/security/qr/service.js');
    const failingQrService = new QrService(
      identityRepo,
      failingSecurityRepo,
      failingAuditService,
      testClock
    );

    // QR resolution must fail closed
    await expect(
      failingQrService.resolveQr({
        userId: FIXTURES.CLINICIAN_A.userId,
        input: { token: qrRes.body.payload },
        requestId: 'test-req',
      })
    ).rejects.toThrow('Security audit logging failed');
  });


  // =========================================================================
  // Case 25: Revocation still works during audit outage where possible
  // =========================================================================
  it('Case 25: Revocation still works during audit outage where possible', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });

    // Mock audit service failure
    const failingSecurityRepo = Object.create(securityRepo);
    failingSecurityRepo.appendAuditEvent = async () => {
      throw new Error('Simulated audit network partition');
    };
    const failingAuditService = new AuditService(failingSecurityRepo);

    const { ConsentService } = await import('../src/security/consent/service.js');
    const failingConsentService = new ConsentService(
      identityRepo,
      failingSecurityRepo,
      failingAuditService,
      testClock
    );

    // Revocation succeeds despite audit write failure due to safety fallback
    const revoked = await failingConsentService.revokeConsent({
      userId: FIXTURES.PATIENT_A.userId,
      consentId: consent.id,
      requestId: 'test-revoke-req',
    });

    expect(revoked.status).toBe('revoked');
    expect(revoked.effectiveStatus).toBe('revoked');

    const updated = await securityRepo.getConsentById(consent.id);
    expect(updated?.status).toBe('revoked');
  });

  // =========================================================================
  // Case 26: Authorization recheck blocks delayed summary release
  // =========================================================================
  it('Case 26: Authorization recheck blocks delayed summary release', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read', 'clinical-summary:generate'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const grant = await prisma.accessGrant.create({
      data: {
        consentId: consent.id,
        patientId: FIXTURES.PATIENT_A.patientId,
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read', 'clinical-summary:generate'],
        expiresAt: new Date(testClock.now().getTime() + 15 * 60 * 1000),
      },
    });

    const summaryWrapper = new ClinicalSummarySecurityWrapper(
      appInstance.securityModule.authorizer,
      appInstance.securityModule.auditService
    );

    // Simulate patient revoking consent DURING LLM summary processing
    await expect(
      summaryWrapper.executeProtectedSummaryGeneration(
        {
          actorUserId: FIXTURES.CLINICIAN_A.userId,
          patientId: FIXTURES.PATIENT_A.patientId,
          accessGrantId: grant.id,
          requestId: 'test-summary-req',
        },
        async (_patientId) => ['Clinical event 1', 'Clinical event 2'],
        async (_records) => {
          // Mid-flight revocation occurs before LLM returns
          await securityRepo.revokeConsentAndAssociatedGrants(consent.id, testClock.now());
          return 'AI Summary Result';
        }
      )
    ).rejects.toThrow('Access denied');
  });

  // =========================================================================
  // Case 27: Concurrent revocation/resolution cannot yield usable access after revocation
  // =========================================================================
  it('Case 27: Concurrent revocation/resolution cannot yield usable access after revocation', async () => {
    const consent = await securityRepo.createConsent({
      patientId: FIXTURES.PATIENT_A.patientId,
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read'],
      expiresAt: new Date(testClock.now().getTime() + 30 * 60 * 1000),
      createdByUserId: FIXTURES.PATIENT_A.userId,
    });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consent.id });

    const token = qrRes.body.payload;

    // Fire revocation and resolution concurrently
    const [revokeResult, resolveResult] = await Promise.all([
      request(appInstance.app)
        .post(`/api/consents/${consent.id}/revoke`)
        .set('Authorization', 'Bearer patient-a-token'),
      request(appInstance.app)
        .post('/api/qr/resolve')
        .set('Authorization', 'Bearer clinician-a-token')
        .send({ token }),
    ]);

    expect(revokeResult.status).toBe(200);

    // Even if resolve raced and managed to create a grant before revocation committed,
    // the subsequent timeline request must be DENIED because the authorizer checks consent
    if (resolveResult.status === 200) {
      const grantId = resolveResult.body.accessGrantId;
      const timelineRes = await request(appInstance.app)
        .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
        .set('Authorization', 'Bearer clinician-a-token')
        .set('X-Access-Grant-Id', grantId);

      expect(timelineRes.status).toBe(403);
      expect(timelineRes.body.error.code).toBe('ACCESS_DENIED');
    } else {
      expect(resolveResult.status).toBe(403);
    }
  });

  // =========================================================================
  // =========================================================================
  // Case 28: Audited Emergency Access Lifecycle (Clinician declaration -> timeline access -> audit trail)
  // =========================================================================
  it('Case 28: Audited Emergency Access Lifecycle (Clinician declaration -> timeline access -> audit trail)', async () => {
    // 1. Clinician A declares emergency access with explicit reasonCode and reasonText
    const emergencyRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'UNRESPONSIVE_TRAUMA',
        reasonText: 'Acute trauma resuscitation: Unresponsive patient in ER shock room',
      });

    expect(emergencyRes.status).toBe(201);
    expect(emergencyRes.body.emergencyGrantId).toBeDefined();
    expect(emergencyRes.body.patientId).toBe(FIXTURES.PATIENT_A.patientId);
    expect(emergencyRes.body.clinicianId).toBe(FIXTURES.CLINICIAN_A.clinicianId);
    expect(emergencyRes.body.reasonCode).toBe('UNRESPONSIVE_TRAUMA');
    expect(emergencyRes.body.scope).toBe('timeline:read');
    expect(emergencyRes.body.notice).toContain('Emergency access — audited — expires at');
    const emergencyGrantId = emergencyRes.body.emergencyGrantId;

    // 2. Clinician A fetches patient timeline using emergency grant
    const timelineRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', emergencyGrantId);

    expect(timelineRes.status).toBe(200);
    expect(timelineRes.body.patientId).toBe(FIXTURES.PATIENT_A.patientId);
    expect(timelineRes.body.timelineEvents).toBeDefined();
    expect(timelineRes.body.accessAudit.authorizedRole).toBe('CLINICIAN');

    // 3. Verify attributable audit entries in database
    const events = await prisma.auditEvent.findMany({
      where: {
        action: { in: ['EMERGENCY_ACCESS_DECLARED', 'EMERGENCY_ACCESS_READ'] },
      },
      orderBy: { timestamp: 'desc' },
    });

    const declaredEvent = events.find((e) => e.action === 'EMERGENCY_ACCESS_DECLARED');
    expect(declaredEvent).toBeDefined();
    expect(declaredEvent?.actorRole).toBe('CLINICIAN');
    expect(declaredEvent?.actorUserId).toBe(FIXTURES.CLINICIAN_A.userId);
    expect(declaredEvent?.outcome).toBe('allowed');
    expect(declaredEvent?.internalReasonCode).toBe('EMERGENCY_OVERRIDE_GRANTED');

    const readEvent = events.find((e) => e.action === 'EMERGENCY_ACCESS_READ');
    expect(readEvent).toBeDefined();
    expect(readEvent?.actorRole).toBe('CLINICIAN');
    expect(readEvent?.actorUserId).toBe(FIXTURES.CLINICIAN_A.userId);
    expect(readEvent?.outcome).toBe('allowed');
    expect(readEvent?.internalReasonCode).toBe('EMERGENCY_ACCESS_AUTHORIZED');

    // SECURITY INVARIANT: reasonText is kept in protected storage, NOT in operational logs
    const safeRefsStr = JSON.stringify(declaredEvent?.safeResourceRefs);
    expect(safeRefsStr).not.toContain('shock room');
  });

  // =========================================================================
  // Case 29: Administrator Denied Emergency Access and Listing
  // =========================================================================
  it('Case 29: Administrator Denied Emergency Access and Listing', async () => {
    // Administrator attempts to declare emergency access
    const adminEmergencyRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer admin-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'IMMINENT_THREAT_TO_LIFE',
        reasonText: 'Administrator routine inspection of records',
      });

    expect(adminEmergencyRes.status).toBe(403);
    expect(adminEmergencyRes.body.error.code).toBe('FORBIDDEN_ROLE');

    // Administrator attempts to list emergency grants
    const adminListRes = await request(appInstance.app)
      .get('/api/emergency-access')
      .set('Authorization', 'Bearer admin-token');

    expect(adminListRes.status).toBe(403);
    expect(adminListRes.body.error.code).toBe('FORBIDDEN_ROLE');

    // Administrator remains unable to access identifiable clinical timeline
    const adminTimeline = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer admin-token');

    expect(adminTimeline.status).toBe(403);
    expect(adminTimeline.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 30: Unverified Clinician and Clinician without Permission Denied
  // =========================================================================
  it('Case 30: Unverified Clinician and Clinician without Permission Denied', async () => {
    // Unverified clinician is denied
    const unverifiedRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer clinician-unverified-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'IMMINENT_THREAT_TO_LIFE',
        reasonText: 'Emergency access request by unverified intern',
      });

    expect(unverifiedRes.status).toBe(403);
    expect(unverifiedRes.body.error.code).toBe('CLINICIAN_NOT_VERIFIED');

    // Verified Clinician B (lacking explicit server-provisioned emergency permission) is denied
    const noPermRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer clinician-b-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'IMMINENT_THREAT_TO_LIFE',
        reasonText: 'Clinician B lacks break-glass server permission',
      });

    expect(noPermRes.status).toBe(403);
    expect(noPermRes.body.error.code).toBe('FORBIDDEN_EMERGENCY_ACCESS');
  });

  // =========================================================================
  // Case 31: Emergency Access Validation (Missing reason, excessive duration, forged fields)
  // =========================================================================
  it('Case 31: Emergency Access Validation (Missing reason, excessive duration, forged fields)', async () => {
    // Reason text under 10 characters
    const shortJustificationRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'IMMINENT_THREAT_TO_LIFE',
        reasonText: 'Urgent',
      });

    expect(shortJustificationRes.status).toBe(400);
    expect(shortJustificationRes.body.error.code).toBe('VALIDATION_ERROR');

    // Duration exceeding bounded 5-minute maximum
    const longDurationRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'IMMINENT_THREAT_TO_LIFE',
        reasonText: 'Patient cardiac arrest requiring ER emergency review',
        durationMinutes: 10,
      });

    expect(longDurationRes.status).toBe(400);
    expect(longDurationRes.body.error.code).toBe('VALIDATION_ERROR');

    // Unauthorized client-supplied forged fields
    const forgedFieldsRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'IMMINENT_THREAT_TO_LIFE',
        reasonText: 'Patient cardiac arrest requiring ER emergency review',
        role: 'ADMIN',
      });

    expect(forgedFieldsRes.status).toBe(400);
    expect(forgedFieldsRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  // =========================================================================
  // Case 32: Emergency Grant 5-Minute Expiry Enforcement
  // =========================================================================
  it('Case 32: Emergency Grant 5-Minute Expiry Enforcement', async () => {
    // Clinician A declares emergency access (server calculates 5-minute duration)
    const emergencyRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'ANAPHYLAXIS',
        reasonText: 'Anaphylactic reaction in urgent care clinic needing immediate history',
      });

    expect(emergencyRes.status).toBe(201);
    const grantId = emergencyRes.body.emergencyGrantId;

    // Advance clock past 5-minute emergency duration (6 minutes)
    testClock.advanceMinutes(6);

    // Subsequent timeline request fails due to expiry
    const timelineRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grantId);

    expect(timelineRes.status).toBe(403);
    expect(timelineRes.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 33: Emergency Grant Early Revocation, Safe Listings, and Scope Limit
  // =========================================================================
  it('Case 33: Emergency Grant Early Revocation, Safe Listings, and Scope Limit', async () => {
    const emergencyRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'ACUTE_CARDIOVASCULAR_COLLAPSE',
        reasonText: 'Intensive care stabilization complete and patient stable',
      });

    const grantId = emergencyRes.body.emergencyGrantId;

    // Clinician revokes the emergency grant early
    const revokeRes = await request(appInstance.app)
      .post(`/api/emergency-access/${grantId}/revoke`)
      .set('Authorization', 'Bearer clinician-a-token');

    expect(revokeRes.status).toBe(200);

    // Revocation is idempotent
    const revokeAgainRes = await request(appInstance.app)
      .post(`/api/emergency-access/${grantId}/revoke`)
      .set('Authorization', 'Bearer clinician-a-token');
    expect(revokeAgainRes.status).toBe(200);

    // Subsequent access fails immediately
    const timelineRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grantId);

    expect(timelineRes.status).toBe(403);
    expect(timelineRes.body.error.code).toBe('ACCESS_DENIED');

    // Patient views safe metadata without private clinician text
    const patientListRes = await request(appInstance.app)
      .get('/api/emergency-access')
      .set('Authorization', 'Bearer patient-a-token');

    expect(patientListRes.status).toBe(200);
    expect(patientListRes.body.length).toBeGreaterThanOrEqual(1);
    const listed = patientListRes.body[0];
    expect(listed.effectiveStatus).toBe('revoked');
    expect(listed.reasonCode).toBe('ACUTE_CARDIOVASCULAR_COLLAPSE');
    expect(listed.reasonText).toBeUndefined(); // Private reason text not exposed in patient list
    expect(listed.notice).toContain('Emergency access');
  });

  // =========================================================================
  // Case 34: Privacy Boundary Rejects Identifiable Fields in Aggregate Feeds
  // =========================================================================
  it('Case 34: Privacy Boundary Rejects Identifiable Fields in Aggregate Feeds', async () => {
    const privacyService = appInstance.securityModule.privacyService;

    // Malicious or leaky feed containing raw patient identifiers
    const leakyFeed = [
      {
        region: 'District-North',
        timeBucket: '2026-W40',
        conditionCategory: 'Respiratory',
        count: 25,
        patientId: FIXTURES.PATIENT_A.patientId, // Identifiable field!
      },
    ];

    await expect(
      privacyService.sanitizeAndProtectAggregateFeed(leakyFeed as any, {
        actorUserId: FIXTURES.ADMINISTRATOR.userId,
        actorRole: 'ADMIN',
        requestId: 'leak-test-req',
      })
    ).rejects.toThrow('Privacy violation');

    // Audit logs privacy check violation
    const violationAudit = await prisma.auditEvent.findFirst({
      where: { internalReasonCode: 'IDENTIFIABLE_PATIENT_DATA_IN_AGGREGATE_FEED' },
    });
    expect(violationAudit).toBeDefined();
    expect(violationAudit?.outcome).toBe('denied');
  });

  // =========================================================================
  // Case 35: Group-Size Suppression Threshold (k >= 10) Returns Unavailable (null), NEVER Zero!
  // =========================================================================
  it('Case 35: Group-Size Suppression Threshold (k >= 10) Returns Unavailable (null), NEVER Zero!', async () => {
    const privacyService = appInstance.securityModule.privacyService;

    const rawBuckets = [
      { region: 'District-North', timeBucket: '2026-W40', conditionCategory: 'Respiratory', count: 45 },
      { region: 'District-North', timeBucket: '2026-W40', conditionCategory: 'Waterborne', count: 4 },  // Suppressed (< 10)
      { region: 'District-South', timeBucket: '2026-W40', conditionCategory: 'Vectorborne', count: 7 }, // Suppressed (< 10)
      { region: 'District-East', timeBucket: '2026-W40', conditionCategory: 'Endocrine', count: 0 },    // Zero count (no cases)
      { region: 'District-West', timeBucket: '2026-W40', conditionCategory: 'Cardiology', count: 12 },  // Valid (>= 10)
    ];

    const permitted = await privacyService.sanitizeAndProtectAggregateFeed(rawBuckets, {
      requestId: 'suppression-test-req',
    });

    expect(permitted.length).toBe(5);

    // Suppressed bucket 1 (Waterborne: 4)
    const waterborne = permitted.find((b) => b.conditionCategory === 'Waterborne');
    expect(waterborne).toBeDefined();
    expect(waterborne?.caseCount).toBeNull(); // UNAVAILABLE, NOT ZERO!
    expect(waterborne?.caseCount).not.toBe(0);
    expect(waterborne?.suppressionStatus).toBe('suppressed_unavailable');

    // Suppressed bucket 2 (Vectorborne: 7)
    const vectorborne = permitted.find((b) => b.conditionCategory === 'Vectorborne');
    expect(vectorborne).toBeDefined();
    expect(vectorborne?.caseCount).toBeNull(); // UNAVAILABLE, NOT ZERO!
    expect(vectorborne?.caseCount).not.toBe(0);
    expect(vectorborne?.suppressionStatus).toBe('suppressed_unavailable');

    // Unsuppressed buckets
    const respiratory = permitted.find((b) => b.conditionCategory === 'Respiratory');
    expect(respiratory?.caseCount).toBe(45);
    expect(respiratory?.suppressionStatus).toBe('available');

    const cardiology = permitted.find((b) => b.conditionCategory === 'Cardiology');
    expect(cardiology?.caseCount).toBe(12);
    expect(cardiology?.suppressionStatus).toBe('available');
  });

  // =========================================================================
  // Case 36: Outbreak Anomaly Aggregate Model Input Validation & Demonstration
  // =========================================================================
  it('Case 36: Outbreak Anomaly Aggregate Model Input Validation & Demonstration', async () => {
    // Administrator queries aggregate endpoint
    const res = await request(appInstance.app)
      .get('/api/analytics/aggregates')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.thresholdApplied).toBe(10);
    expect(res.body.aggregates).toBeDefined();
    expect(Array.isArray(res.body.aggregates)).toBe(true);

    const aggregates = res.body.aggregates;

    // Verify all records conform strictly to PermittedAggregateRecord schema
    for (const item of aggregates) {
      expect(item.region).toBeDefined();
      expect(item.timeBucket).toBeDefined();
      expect(item.conditionCategory).toBeDefined();
      expect(['available', 'suppressed_unavailable']).toContain(item.suppressionStatus);
      if (item.suppressionStatus === 'suppressed_unavailable') {
        expect(item.caseCount).toBeNull();
      } else {
        expect(typeof item.caseCount).toBe('number');
      }

      // Ensure NO identifiable patient IDs or names are present
      expect(item.patientId).toBeUndefined();
      expect(item.mrn).toBeUndefined();
      expect(item.name).toBeUndefined();
    }

    // Verify outbreak anomaly pattern present in test sequence (42 -> 45 -> 118)
    const outbreakBucket = aggregates.find(
      (a: any) => a.conditionCategory === 'Respiratory' && a.timeBucket === '2026-W40'
    );
    expect(outbreakBucket).toBeDefined();
    expect(outbreakBucket.caseCount).toBe(118); // Labeled outbreak anomaly
  });

  // =========================================================================
  // Case 37: Centralized Authorization Boundary Distinguishes All 3 Modes
  // =========================================================================
  it('Case 37: Centralized Authorization Boundary Distinguishes All 3 Modes (PATIENT_SELF, NORMAL_CONSENT, EMERGENCY_OVERRIDE)', async () => {
    // 1. PATIENT_SELF mode: Patient A requests own timeline
    const patientRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer patient-a-token');

    expect(patientRes.status).toBe(200);
    expect(patientRes.body.accessAudit.authorizedRole).toBe('PATIENT');
    expect(patientRes.body.accessAudit.accessMode).toBe('PATIENT_SELF');

    // 2. NORMAL_CONSENT mode: Setup consent -> QR -> grant
    const consentRes = await request(appInstance.app)
      .post('/api/consents')
      .set('Authorization', 'Bearer patient-a-token')
      .send({
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read', 'clinical-summary:generate'],
        durationMinutes: 30,
      });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consentRes.body.id });
    const resolveRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token: qrRes.body.payload });
    const normalGrantId = resolveRes.body.accessGrantId;

    const normalRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', normalGrantId);

    expect(normalRes.status).toBe(200);
    expect(normalRes.body.accessAudit.authorizedRole).toBe('CLINICIAN');
    expect(normalRes.body.accessAudit.accessMode).toBe('NORMAL_CONSENT');
    expect(normalRes.body.accessAudit.grantId).toBe(normalGrantId);

    // 3. EMERGENCY_OVERRIDE mode: Clinician A creates break-glass emergency grant
    const emergencyRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'IMMINENT_THREAT_TO_LIFE',
        reasonText: 'Acute life-threatening medical emergency',
      });
    const emergencyGrantId = emergencyRes.body.emergencyGrantId;

    const emergencyAccessRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', emergencyGrantId);

    expect(emergencyAccessRes.status).toBe(200);
    expect(emergencyAccessRes.body.accessAudit.authorizedRole).toBe('CLINICIAN');
    expect(emergencyAccessRes.body.accessAudit.accessMode).toBe('EMERGENCY_OVERRIDE');
    expect(emergencyAccessRes.body.accessAudit.grantId).toBe(emergencyGrantId);

    // 4. Administrator denied: Always forbidden from identifiable clinical records
    const adminRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer admin-token');

    expect(adminRes.status).toBe(403);
    expect(adminRes.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 38: Member 2 Clinical Route Protection Across All Secondary Paths
  // =========================================================================
  it('Case 38: Member 2 Clinical Route Protection Across All Secondary Paths', async () => {
    // Setup normal grant for Clinician A
    const consentRes = await request(appInstance.app)
      .post('/api/consents')
      .set('Authorization', 'Bearer patient-a-token')
      .send({
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
        durationMinutes: 30,
      });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consentRes.body.id });
    const resolveRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token: qrRes.body.payload });
    const grantId = resolveRes.body.accessGrantId;

    const endpoints = [
      `/api/patients/${FIXTURES.PATIENT_A.patientId}/encounters/enc-1`,
      `/api/patients/${FIXTURES.PATIENT_A.patientId}/medications`,
      `/api/patients/${FIXTURES.PATIENT_A.patientId}/download`,
      `/api/patients/${FIXTURES.PATIENT_A.patientId}/export`,
      `/api/patients/${FIXTURES.PATIENT_A.patientId}/records/search?q=cardiology`,
    ];

    for (const ep of endpoints) {
      // 1. Unauthenticated -> 401
      const unauth = await request(appInstance.app).get(ep);
      expect(unauth.status).toBe(401);

      // 2. Administrator -> 403 ACCESS_DENIED
      const admin = await request(appInstance.app)
        .get(ep)
        .set('Authorization', 'Bearer admin-token');
      expect(admin.status).toBe(403);
      expect(admin.body.error.code).toBe('ACCESS_DENIED');

      // 3. Cross-patient -> 403 ACCESS_DENIED
      const crossPatient = await request(appInstance.app)
        .get(ep)
        .set('Authorization', 'Bearer patient-b-token');
      expect(crossPatient.status).toBe(403);
      expect(crossPatient.body.error.code).toBe('ACCESS_DENIED');

      // 4. Clinician without grant -> 403 ACCESS_DENIED
      const noGrant = await request(appInstance.app)
        .get(ep)
        .set('Authorization', 'Bearer clinician-a-token');
      expect(noGrant.status).toBe(403);
      expect(noGrant.body.error.code).toBe('ACCESS_DENIED');

      // 5. Clinician with valid normal grant -> 200 OK
      const valid = await request(appInstance.app)
        .get(ep)
        .set('Authorization', 'Bearer clinician-a-token')
        .set('X-Access-Grant-Id', grantId);
      expect(valid.status).toBe(200);
      expect(valid.body.accessAudit.accessMode).toBe('NORMAL_CONSENT');

      // 6. Patient-self -> 200 OK
      const patientSelf = await request(appInstance.app)
        .get(ep)
        .set('Authorization', 'Bearer patient-a-token');
      expect(patientSelf.status).toBe(200);
      expect(patientSelf.body.accessAudit.accessMode).toBe('PATIENT_SELF');
    }
  });

  // =========================================================================
  // Case 39: Precise Resource Auditing Records Exact Requested Resource
  // =========================================================================
  it('Case 39: Precise Resource Auditing Records Exact Requested Resource', async () => {
    // Setup normal grant
    const consentRes = await request(appInstance.app)
      .post('/api/consents')
      .set('Authorization', 'Bearer patient-a-token')
      .send({
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
        durationMinutes: 30,
      });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consentRes.body.id });
    const resolveRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token: qrRes.body.payload });
    const grantId = resolveRes.body.accessGrantId;

    // Call individual encounters
    await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/encounters/enc-42`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grantId);

    // Call medications
    await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/medications`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grantId);

    // Call download
    await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/download`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grantId);

    // Call export
    await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/export`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grantId);

    // Call search
    await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/records/search?q=metformin`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grantId);

    // Inspect database audit logs
    const auditLogs = await prisma.auditEvent.findMany({
      where: {
        actorUserId: FIXTURES.CLINICIAN_A.userId,
        action: 'RECORD_ACCESS_CHECK',
        outcome: 'allowed',
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    const resourcePaths = auditLogs.map((log) => (log.safeResourceRefs as any).resourcePath);

    expect(resourcePaths).toContain('encounter_detail');
    expect(resourcePaths).toContain('patient_medications');
    expect(resourcePaths).toContain('patient_record_download');
    expect(resourcePaths).toContain('patient_record_export');
    expect(resourcePaths).toContain('patient_record_search');
  });

  // =========================================================================
  // Case 40: Emergency Override Boundaries: Bedside Read Allowed, Bulk Export/Download/Summary Strictly Blocked
  // =========================================================================
  it('Case 40: Emergency Override Boundaries: Bedside Read Allowed, Bulk Export/Download/Summary Strictly Blocked', async () => {
    // Clinician A creates an emergency access grant
    const emergencyRes = await request(appInstance.app)
      .post('/api/emergency-access')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({
        patientId: FIXTURES.PATIENT_A.patientId,
        reasonCode: 'UNRESPONSIVE_TRAUMA',
        reasonText: 'Emergency bedside trauma assessment in progress',
      });
    expect(emergencyRes.status).toBe(201);
    const emergencyGrantId = emergencyRes.body.emergencyGrantId;

    // 1. Bedside reads succeed under emergency override
    const timelineRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', emergencyGrantId);
    expect(timelineRes.status).toBe(200);
    expect(timelineRes.body.accessAudit.accessMode).toBe('EMERGENCY_OVERRIDE');

    const encounterRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/encounters/enc-1`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', emergencyGrantId);
    expect(encounterRes.status).toBe(200);
    expect(encounterRes.body.accessAudit.accessMode).toBe('EMERGENCY_OVERRIDE');

    const medsRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/medications`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', emergencyGrantId);
    expect(medsRes.status).toBe(200);
    expect(medsRes.body.accessAudit.accessMode).toBe('EMERGENCY_OVERRIDE');

    const searchRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/records/search?q=allergy`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', emergencyGrantId);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.accessAudit.accessMode).toBe('EMERGENCY_OVERRIDE');

    // 2. Bulk download and export are strictly prohibited under emergency override!
    const downloadRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/download`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', emergencyGrantId);
    expect(downloadRes.status).toBe(403);
    expect(downloadRes.body.error.code).toBe('ACCESS_DENIED');

    const exportRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/export`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', emergencyGrantId);
    expect(exportRes.status).toBe(403);
    expect(exportRes.body.error.code).toBe('ACCESS_DENIED');

    // 3. AI Summary generation is strictly prohibited under emergency override!
    const summaryRes = await request(appInstance.app)
      .post(`/api/patients/${FIXTURES.PATIENT_A.patientId}/clinical-summary`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', emergencyGrantId);
    expect(summaryRes.status).toBe(403);
    expect(summaryRes.body.error.code).toBe('ACCESS_DENIED');
  });

  // =========================================================================
  // Case 41: Absolute Invariant: No Automatic Fallback From Failed Normal Access
  // =========================================================================
  it('Case 41: Absolute Invariant: No Automatic Fallback From Failed Normal Access', async () => {
    // Setup normal consent grant
    const consentRes = await request(appInstance.app)
      .post('/api/consents')
      .set('Authorization', 'Bearer patient-a-token')
      .send({
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read'],
        durationMinutes: 10,
      });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consentRes.body.id });
    const resolveRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token: qrRes.body.payload });
    const normalGrantId = resolveRes.body.accessGrantId;

    // Advance clock past expiration
    testClock.advanceMinutes(15);

    // Clinician A (who has emergency permissions) tries to access timeline using expired normal grant
    const res = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/timeline`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', normalGrantId);

    // MUST FAIL CLOSED with 403, and NOT silently or automatically fall back to emergency!
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCESS_DENIED');

    // Verify audit log recorded normal grant expiry, not emergency
    const audit = await prisma.auditEvent.findFirst({
      where: {
        actorUserId: FIXTURES.CLINICIAN_A.userId,
        internalReasonCode: 'GRANT_REVOKED_OR_EXPIRED',
      },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit).toBeDefined();
    expect(audit?.action).toBe('RECORD_ACCESS_CHECK');
  });

  // =========================================================================
  // Case 42: Member 4 Integration: Normal Consent Summary, Server Retrieval, Recheck, Cache Reauth
  // =========================================================================
  it('Case 42: Member 4 Integration: Normal Consent Summary, Server Retrieval, Recheck, Cache Reauth', async () => {
    // 1. Consent with both timeline:read and clinical-summary:generate
    const consentRes = await request(appInstance.app)
      .post('/api/consents')
      .set('Authorization', 'Bearer patient-a-token')
      .send({
        clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
        scopes: ['timeline:read', 'clinical-summary:generate'],
        durationMinutes: 30,
      });
    const qrRes = await request(appInstance.app)
      .post('/api/qr/generate')
      .set('Authorization', 'Bearer patient-a-token')
      .send({ consentId: consentRes.body.id });
    const resolveRes = await request(appInstance.app)
      .post('/api/qr/resolve')
      .set('Authorization', 'Bearer clinician-a-token')
      .send({ token: qrRes.body.payload });
    const grantId = resolveRes.body.accessGrantId;

    // 2. Clinician requests summary generation -> 200 OK
    const summaryRes = await request(appInstance.app)
      .post(`/api/patients/${FIXTURES.PATIENT_A.patientId}/clinical-summary`)
      .set('Authorization', 'Bearer clinician-a-token')
      .set('X-Access-Grant-Id', grantId);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.summaryText).toContain('Patient summary generated from');

    // 3. Patient directly attempting to generate summary -> 403 ACCESS_DENIED
    const patientDirectRes = await request(appInstance.app)
      .post(`/api/patients/${FIXTURES.PATIENT_A.patientId}/clinical-summary`)
      .set('Authorization', 'Bearer patient-a-token');

    expect(patientDirectRes.status).toBe(403);
    expect(patientDirectRes.body.error.code).toBe('ACCESS_DENIED');

    // 4. Cache reauthorization test via ClinicalSummarySecurityWrapper directly
    const wrapper = new ClinicalSummarySecurityWrapper(
      appInstance.securityModule.authorizer,
      appInstance.securityModule.auditService
    );

    let cacheAccessed = false;
    const cachedSummary = await wrapper.reauthorizeCachedSummaryAccess(
      {
        actorUserId: FIXTURES.CLINICIAN_A.userId,
        patientId: FIXTURES.PATIENT_A.patientId,
        accessGrantId: grantId,
        requestId: 'cache-req-1',
      },
      async (pId) => {
        cacheAccessed = true;
        return { cached: true, pId };
      }
    );

    expect(cacheAccessed).toBe(true);
    expect(cachedSummary?.cached).toBe(true);

    // 5. If grant expires, cache reauthorization fails closed!
    testClock.advanceMinutes(35);
    cacheAccessed = false;
    await expect(
      wrapper.reauthorizeCachedSummaryAccess(
        {
          actorUserId: FIXTURES.CLINICIAN_A.userId,
          patientId: FIXTURES.PATIENT_A.patientId,
          accessGrantId: grantId,
          requestId: 'cache-req-2',
        },
        async (pId) => {
          cacheAccessed = true;
          return { cached: true, pId };
        }
      )
    ).rejects.toThrow();

    expect(cacheAccessed).toBe(false); // Cache was NEVER read when authorization failed!
  });

  // =========================================================================
  // Case 43: Approved Model-Input Contract & Runtime Validation
  // =========================================================================
  it('Case 43: Approved Model-Input Contract & Runtime Validation', async () => {
    // 1. Compliant record passes validation
    const validRecords = [
      {
        region: 'District-North',
        timeBucket: '2026-W40',
        conditionCategory: 'Respiratory',
        caseCount: 45,
        suppressed: false,
        releaseVersion: 'v1.0-2026',
        approvedDataLabel: 'GOVERNED_AGGREGATE',
        insufficientHistory: false,
      },
      {
        region: 'District-North',
        timeBucket: '2026-W40',
        conditionCategory: 'Waterborne',
        caseCount: null, // Honest null for suppressed cell!
        suppressed: true,
        releaseVersion: 'v1.0-2026',
        approvedDataLabel: 'GOVERNED_AGGREGATE',
        insufficientHistory: false,
      },
    ];

    const validated = validateApprovedModelInputs(validRecords, 'test-req-43');
    expect(validated.length).toBe(2);
    expect(validated[0].caseCount).toBe(45);
    expect(validated[1].caseCount).toBeNull();
    expect(validated[1].suppressed).toBe(true);

    // 2. Reject identifiable row payloads immediately
    const leakyRecord = [
      {
        region: 'District-North',
        timeBucket: '2026-W40',
        conditionCategory: 'Respiratory',
        caseCount: 45,
        suppressed: false,
        releaseVersion: 'v1.0-2026',
        approvedDataLabel: 'GOVERNED_AGGREGATE',
        patientId: '22222222-2222-4222-8222-222222222222', // PII!
      },
    ];
    expect(() => validateApprovedModelInputs(leakyRecord, 'test-req-43-leak')).toThrow(
      'Privacy violation: Identifiable attribute'
    );

    // 3. Reject suppressed cells containing exact small counts
    const invalidSuppressedExact = [
      {
        region: 'District-North',
        timeBucket: '2026-W40',
        conditionCategory: 'Waterborne',
        caseCount: 4, // Exact count in suppressed cell is forbidden!
        suppressed: true,
        releaseVersion: 'v1.0-2026',
        approvedDataLabel: 'GOVERNED_AGGREGATE',
      },
    ];
    expect(() => validateApprovedModelInputs(invalidSuppressedExact, 'test-req-43-exact')).toThrow(
      'Suppressed cells must have caseCount: null'
    );

    // 4. Reject suppressed cells containing zero
    const invalidSuppressedZero = [
      {
        region: 'District-North',
        timeBucket: '2026-W40',
        conditionCategory: 'Waterborne',
        caseCount: 0, // NEVER ZERO!
        suppressed: true,
        releaseVersion: 'v1.0-2026',
        approvedDataLabel: 'GOVERNED_AGGREGATE',
      },
    ];
    expect(() => validateApprovedModelInputs(invalidSuppressedZero, 'test-req-43-zero')).toThrow(
      'Suppressed cells must have caseCount: null'
    );

    // 5. Reject unknown dimensions or fields (strict Zod schema)
    const unknownDimensions = [
      {
        region: 'District-North',
        timeBucket: '2026-W40',
        conditionCategory: 'Respiratory',
        caseCount: 45,
        suppressed: false,
        releaseVersion: 'v1.0-2026',
        approvedDataLabel: 'GOVERNED_AGGREGATE',
        customCohortFilter: 'smokers_under_40', // Unknown dimension!
      },
    ];
    expect(() => validateApprovedModelInputs(unknownDimensions, 'test-req-43-unknown')).toThrow();
  });

  // =========================================================================
  // Case 44: Distinct Contributing Patient Counting Method
  // =========================================================================
  it('Case 44: Distinct Contributing Patient Counting Method (Repeated visits cannot inflate k >= 10 eligibility)', () => {
    // Group 1: 1 patient visiting 25 times
    const singlePatientHighVisits = {
      region: 'District-North',
      timeBucket: '2026-W40',
      conditionCategory: 'Respiratory',
      distinctPatientIds: ['pat-single-patient'],
      caseCount: 25, // 25 encounters, but only 1 distinct patient
    };

    const eligibility1 = evaluateGroupEligibility(singlePatientHighVisits, 10);
    expect(eligibility1.distinctPatients).toBe(1);
    expect(eligibility1.suppressed).toBe(true);
    expect(eligibility1.caseCount).toBeNull(); // Must be null, NOT 25 and NOT 0!

    // Group 2: 12 distinct patients with 12 encounters
    const twelveDistinctPatients = {
      region: 'District-North',
      timeBucket: '2026-W40',
      conditionCategory: 'Respiratory',
      distinctPatientIds: Array.from({ length: 12 }, (_, i) => `pat-${i}`),
      caseCount: 12,
    };

    const eligibility2 = evaluateGroupEligibility(twelveDistinctPatients, 10);
    expect(eligibility2.distinctPatients).toBe(12);
    expect(eligibility2.suppressed).toBe(false);
    expect(eligibility2.caseCount).toBe(12);

    // Group 3: 0 distinct patients, 0 cases (no cases recorded)
    const zeroGroup = {
      region: 'District-North',
      timeBucket: '2026-W40',
      conditionCategory: 'Cardiometabolic',
      distinctPatientIds: [],
      caseCount: 0,
    };
    const eligibility3 = evaluateGroupEligibility(zeroGroup, 10);
    expect(eligibility3.distinctPatients).toBe(0);
    expect(eligibility3.suppressed).toBe(false);
    expect(eligibility3.caseCount).toBe(0);
  });

  // =========================================================================
  // Case 45: Complementary Suppression (Preventing Subtraction Leaks)
  // =========================================================================
  it('Case 45: Complementary Suppression (Preventing Subtraction Leaks)', () => {
    // Slice for District-North 2026-W40
    // If Respiratory is 45 and Waterborne is suppressed (null), but Vectorborne is 12,
    // complementary suppression must suppress Vectorborne so subtraction does not reveal Waterborne!
    const records = [
      {
        region: 'District-North' as const,
        timeBucket: '2026-W40',
        conditionCategory: 'Respiratory' as const,
        caseCount: 45,
        suppressed: false,
        releaseVersion: 'v1.0',
        approvedDataLabel: 'GOVERNED_AGGREGATE' as const,
        insufficientHistory: false,
      },
      {
        region: 'District-North' as const,
        timeBucket: '2026-W40',
        conditionCategory: 'Waterborne' as const,
        caseCount: null, // Primary suppression (< 10)
        suppressed: true,
        releaseVersion: 'v1.0',
        approvedDataLabel: 'GOVERNED_AGGREGATE' as const,
        insufficientHistory: false,
      },
      {
        region: 'District-North' as const,
        timeBucket: '2026-W40',
        conditionCategory: 'Vectorborne' as const,
        caseCount: 12, // Second smallest cell
        suppressed: false,
        releaseVersion: 'v1.0',
        approvedDataLabel: 'GOVERNED_AGGREGATE' as const,
        insufficientHistory: false,
      },
    ];

    const protectedSlice = applyComplementarySuppression(records);

    // After complementary suppression:
    // Exactly 2 cells must now be suppressed in the slice
    const suppressedCount = protectedSlice.filter((r) => r.suppressed).length;
    expect(suppressedCount).toBe(2);

    const vectorborne = protectedSlice.find((r) => r.conditionCategory === 'Vectorborne');
    expect(vectorborne?.suppressed).toBe(true);
    expect(vectorborne?.caseCount).toBeNull();
  });

  // =========================================================================
  // Case 46: Aggregate-Only Administrator Role Boundary
  // =========================================================================
  it('Case 46: Aggregate-Only Administrator Role Boundary (Receives aggregates, blocked from drilldowns/EHR/emergency)', async () => {
    // 1. Administrator retrieves approved aggregates -> 200 OK
    const aggRes = await request(appInstance.app)
      .get('/api/analytics/aggregates')
      .set('Authorization', 'Bearer admin-token');
    expect(aggRes.status).toBe(200);
    expect(aggRes.body.aggregates).toBeDefined();

    // 2. Administrator retrieves governed model-input feed -> 200 OK
    const modelRes = await request(appInstance.app)
      .get('/api/analytics/model-input')
      .set('Authorization', 'Bearer admin-token');
    expect(modelRes.status).toBe(200);
    expect(modelRes.body.records).toBeDefined();
    for (const record of modelRes.body.records) {
      if (record.suppressed) {
        expect(record.caseCount).toBeNull(); // NEVER 0!
      }
    }

    // 3. Administrator is strictly DENIED drilldown into individual patient records
    const drilldownRes = await request(appInstance.app)
      .get(`/api/analytics/drilldown/${FIXTURES.PATIENT_A.patientId}`)
      .set('Authorization', 'Bearer admin-token');
    expect(drilldownRes.status).toBe(403);
    expect(drilldownRes.body.error.code).toBe('ACCESS_DENIED');

    // 4. Administrator is strictly DENIED emergency access listing
    const emergencyRes = await request(appInstance.app)
      .get('/api/emergency-access')
      .set('Authorization', 'Bearer admin-token');
    expect(emergencyRes.status).toBe(403);
    expect(['ACCESS_DENIED', 'FORBIDDEN_ROLE']).toContain(emergencyRes.body.error.code);

    // 5. Administrator is strictly DENIED bulk record export
    const exportRes = await request(appInstance.app)
      .get(`/api/patients/${FIXTURES.PATIENT_A.patientId}/export`)
      .set('Authorization', 'Bearer admin-token');
    expect(exportRes.status).toBe(403);
    expect(exportRes.body.error.code).toBe('ACCESS_DENIED');

    // 6. Test aggregate-only authorization helper directly
    const auditService = appInstance.securityModule.auditService;
    const authResult = await authorizeAggregateAccess({
      actorUserId: FIXTURES.ADMINISTRATOR.userId,
      identityRepo,
      auditService,
      requestId: 'test-admin-check',
      requestedResource: 'analytics_dashboard',
    });
    expect(authResult.authorized).toBe(true);
    expect(authResult.isAggregateOnly).toBe(true);
    expect(authResult.canAccessIdentifiableRecords).toBe(false);

    // Patient cannot query aggregate public health feeds
    await expect(
      authorizeAggregateAccess({
        actorUserId: FIXTURES.PATIENT_A.userId,
        identityRepo,
        auditService,
        requestId: 'test-patient-check',
        requestedResource: 'analytics_dashboard',
      })
    ).rejects.toThrow('Patients cannot query regional disease surveillance aggregates.');
  });

  // =========================================================================
  // Case 47: Member 1 Typed API Client Methods (All 9 Methods Verified)
  // =========================================================================
  it('Case 47: Member 1 Typed API Client Methods (All 9 Methods Verified)', async () => {
    // 1. Mock fetch wrapper connecting MediVaultSecurityClient directly to appInstance.app
    let activeToken: string | null = 'patient-a-token';
    const client = new MediVaultSecurityClient({
      baseUrl: '/api',
      getAuthToken: () => activeToken,
    });

    // Provide custom fetch override that routes through supertest
    (client as any).request = async (endpoint: string, options: any = {}, customHeaders: any = {}) => {
      const method = (options.method || 'GET').toLowerCase();
      let req = (request(appInstance.app) as any)[method](`/api${endpoint}`);
      if (activeToken) {
        req = req.set('Authorization', `Bearer ${activeToken}`);
      }
      for (const [k, v] of Object.entries(customHeaders)) {
        req = req.set(k, v as string);
      }
      if (options.body) {
        req = req.send(JSON.parse(options.body));
      }
      const res = await req;
      if (res.status >= 400) {
        throw { status: res.status, error: res.body.error || { code: 'HTTP_ERROR', message: res.text } };
      }
      return res.body;
    };

    // Method 1: listAvailableClinicians
    const clinicians = await client.listAvailableClinicians();
    expect(Array.isArray(clinicians)).toBe(true);
    expect(clinicians.length).toBeGreaterThan(0);
    const verifiedClinician = clinicians.find((c) => c.clinicianId === FIXTURES.CLINICIAN_A.clinicianId);
    expect(verifiedClinician).toBeDefined();

    // Method 2: createConsent
    const consent = await client.createConsent({
      clinicianId: FIXTURES.CLINICIAN_A.clinicianId,
      scopes: ['timeline:read', 'clinical-summary:generate'],
      durationMinutes: 30,
    });
    expect(consent.id).toBeDefined();
    expect(consent.patientId).toBe(FIXTURES.PATIENT_A.patientId);

    // Method 3: listConsents
    const consents = await client.listConsents();
    expect(consents.some((c) => c.id === consent.id)).toBe(true);

    // Method 4: generateQr
    const qr = await client.generateQr(consent.id);
    expect(qr.payload).toContain('MEDVIADUCT:v1:');

    // Method 5: resolveQr (Switch actor to Clinician A)
    activeToken = 'clinician-a-token';
    const grant = await client.resolveQr(qr.payload);
    expect(grant.accessGrantId).toBeDefined();
    expect(grant.patientId).toBe(FIXTURES.PATIENT_A.patientId);

    // Authorized record fetch with grant reference
    const timeline = await client.fetchAuthorizedRecord<any>(
      grant.patientId,
      grant.accessGrantId,
      'timeline'
    );
    expect(timeline.timelineEvents).toBeDefined();

    // Method 6: revokeConsent (Switch actor back to Patient A)
    activeToken = 'patient-a-token';
    const revokedConsent = await client.revokeConsent(consent.id);
    expect(revokedConsent.status).toBe('revoked');

    // Method 7: requestEmergencyAccess (Switch actor to Clinician A)
    activeToken = 'clinician-a-token';
    const emergency = await client.requestEmergencyAccess({
      patientId: FIXTURES.PATIENT_A.patientId,
      reasonCode: 'UNRESPONSIVE_TRAUMA',
      reasonText: 'Patient in shock room following severe multiple trauma accident',
    });
    expect(emergency.emergencyGrantId).toBeDefined();
    expect(emergency.notice).toContain('Emergency access — audited');

    // Method 8: listEmergencyAccess
    const emergencyList = await client.listEmergencyAccess();
    expect(emergencyList.length).toBeGreaterThan(0);
    const foundGrant = emergencyList.find((g) => g.id === emergency.emergencyGrantId);
    expect(foundGrant).toBeDefined();

    // Method 9: revokeEmergencyAccess
    const revokeEmergency = await client.revokeEmergencyAccess(emergency.emergencyGrantId);
    expect(revokeEmergency.revokedAt).toBeDefined();
    expect(revokeEmergency.notice).toContain('Emergency access revoked');
  });
});


