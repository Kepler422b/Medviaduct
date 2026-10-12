import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  AuthenticationAdapter,
  AuthenticatedUser,
  Clock,
} from '../src/security/contracts/interfaces.js';
import { FIXTURES } from '../src/security/contracts/fixtures.js';
import { seedFixtures } from '../prisma/seed.js';

/**
 * TestClock
 * Injectable virtual clock allowing instantaneous time progression in tests.
 */
export class TestClock implements Clock {
  private currentTime: Date;

  constructor(initialTime?: Date) {
    this.currentTime = initialTime ?? new Date('2026-10-10T12:00:00.000Z');
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  advanceMinutes(minutes: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + minutes * 60 * 1000);
  }

  advanceSeconds(seconds: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + seconds * 1000);
  }

  setTime(date: Date): void {
    this.currentTime = new Date(date.getTime());
  }
}

/**
 * TestAuthAdapter
 * Test-only authentication adapter that maps deterministic test bearer tokens
 * to seeded user IDs.
 *
 * CRITICAL SECURITY INVARIANT:
 * This fixture adapter is strictly scoped to the test harness and is NEVER exported
 * or imported into production runtime hosts.
 */
export class TestAuthAdapter implements AuthenticationAdapter {
  private readonly tokenToUserIdMap: Map<string, string> = new Map([
    ['patient-a-token', FIXTURES.PATIENT_A.userId],
    ['patient-b-token', FIXTURES.PATIENT_B.userId],
    ['clinician-a-token', FIXTURES.CLINICIAN_A.userId],
    ['clinician-b-token', FIXTURES.CLINICIAN_B.userId],
    ['clinician-unverified-token', FIXTURES.CLINICIAN_UNVERIFIED.userId],
    ['admin-token', FIXTURES.ADMINISTRATOR.userId],
  ]);

  async authenticate(req: Request): Promise<AuthenticatedUser | null> {
    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return null;
    }

    const token = match[1].trim();
    const userId = this.tokenToUserIdMap.get(token);
    if (!userId) {
      return null;
    }

    return { userId };
  }
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  // Clear security entity tables in foreign-key dependency order
  await prisma.accessGrant.deleteMany();
  await prisma.emergencyAccessGrant.deleteMany();
  await prisma.qrToken.deleteMany();
  await prisma.consent.deleteMany();
  // Reseed deterministic identity profiles
  await seedFixtures(prisma);
}
