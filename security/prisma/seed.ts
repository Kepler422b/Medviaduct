import { PrismaClient } from '@prisma/client';
import { FIXTURES } from '../src/security/contracts/fixtures.js';

const prisma = new PrismaClient();

export async function seedFixtures(client: PrismaClient = prisma) {
  // eslint-disable-next-line no-console
  console.log('Seeding synthetic demo fixtures (idempotent)...');

  // Patient A
  await client.userAccount.upsert({
    where: { id: FIXTURES.PATIENT_A.userId },
    update: { email: FIXTURES.PATIENT_A.email, role: 'PATIENT', isActive: true },
    create: {
      id: FIXTURES.PATIENT_A.userId,
      email: FIXTURES.PATIENT_A.email,
      role: 'PATIENT',
      isActive: true,
    },
  });
  await client.patientProfile.upsert({
    where: { id: FIXTURES.PATIENT_A.patientId },
    update: { userId: FIXTURES.PATIENT_A.userId, mrn: FIXTURES.PATIENT_A.mrn },
    create: {
      id: FIXTURES.PATIENT_A.patientId,
      userId: FIXTURES.PATIENT_A.userId,
      mrn: FIXTURES.PATIENT_A.mrn,
    },
  });

  // Patient B
  await client.userAccount.upsert({
    where: { id: FIXTURES.PATIENT_B.userId },
    update: { email: FIXTURES.PATIENT_B.email, role: 'PATIENT', isActive: true },
    create: {
      id: FIXTURES.PATIENT_B.userId,
      email: FIXTURES.PATIENT_B.email,
      role: 'PATIENT',
      isActive: true,
    },
  });
  await client.patientProfile.upsert({
    where: { id: FIXTURES.PATIENT_B.patientId },
    update: { userId: FIXTURES.PATIENT_B.userId, mrn: FIXTURES.PATIENT_B.mrn },
    create: {
      id: FIXTURES.PATIENT_B.patientId,
      userId: FIXTURES.PATIENT_B.userId,
      mrn: FIXTURES.PATIENT_B.mrn,
    },
  });

  // Verified Clinician A
  await client.userAccount.upsert({
    where: { id: FIXTURES.CLINICIAN_A.userId },
    update: { email: FIXTURES.CLINICIAN_A.email, role: 'CLINICIAN', isActive: true },
    create: {
      id: FIXTURES.CLINICIAN_A.userId,
      email: FIXTURES.CLINICIAN_A.email,
      role: 'CLINICIAN',
      isActive: true,
    },
  });
  await client.clinicianProfile.upsert({
    where: { id: FIXTURES.CLINICIAN_A.clinicianId },
    update: {
      userId: FIXTURES.CLINICIAN_A.userId,
      licenseNumber: FIXTURES.CLINICIAN_A.licenseNumber,
      isVerified: FIXTURES.CLINICIAN_A.isVerified,
      verificationStatus: FIXTURES.CLINICIAN_A.verificationStatus,
      hasEmergencyAccessPermission: FIXTURES.CLINICIAN_A.hasEmergencyAccessPermission,
    },
    create: {
      id: FIXTURES.CLINICIAN_A.clinicianId,
      userId: FIXTURES.CLINICIAN_A.userId,
      licenseNumber: FIXTURES.CLINICIAN_A.licenseNumber,
      isVerified: FIXTURES.CLINICIAN_A.isVerified,
      verificationStatus: FIXTURES.CLINICIAN_A.verificationStatus,
      hasEmergencyAccessPermission: FIXTURES.CLINICIAN_A.hasEmergencyAccessPermission,
    },
  });

  // Verified Clinician B
  await client.userAccount.upsert({
    where: { id: FIXTURES.CLINICIAN_B.userId },
    update: { email: FIXTURES.CLINICIAN_B.email, role: 'CLINICIAN', isActive: true },
    create: {
      id: FIXTURES.CLINICIAN_B.userId,
      email: FIXTURES.CLINICIAN_B.email,
      role: 'CLINICIAN',
      isActive: true,
    },
  });
  await client.clinicianProfile.upsert({
    where: { id: FIXTURES.CLINICIAN_B.clinicianId },
    update: {
      userId: FIXTURES.CLINICIAN_B.userId,
      licenseNumber: FIXTURES.CLINICIAN_B.licenseNumber,
      isVerified: FIXTURES.CLINICIAN_B.isVerified,
      verificationStatus: FIXTURES.CLINICIAN_B.verificationStatus,
      hasEmergencyAccessPermission: FIXTURES.CLINICIAN_B.hasEmergencyAccessPermission,
    },
    create: {
      id: FIXTURES.CLINICIAN_B.clinicianId,
      userId: FIXTURES.CLINICIAN_B.userId,
      licenseNumber: FIXTURES.CLINICIAN_B.licenseNumber,
      isVerified: FIXTURES.CLINICIAN_B.isVerified,
      verificationStatus: FIXTURES.CLINICIAN_B.verificationStatus,
      hasEmergencyAccessPermission: FIXTURES.CLINICIAN_B.hasEmergencyAccessPermission,
    },
  });

  // Unverified Clinician
  await client.userAccount.upsert({
    where: { id: FIXTURES.CLINICIAN_UNVERIFIED.userId },
    update: { email: FIXTURES.CLINICIAN_UNVERIFIED.email, role: 'CLINICIAN', isActive: true },
    create: {
      id: FIXTURES.CLINICIAN_UNVERIFIED.userId,
      email: FIXTURES.CLINICIAN_UNVERIFIED.email,
      role: 'CLINICIAN',
      isActive: true,
    },
  });
  await client.clinicianProfile.upsert({
    where: { id: FIXTURES.CLINICIAN_UNVERIFIED.clinicianId },
    update: {
      userId: FIXTURES.CLINICIAN_UNVERIFIED.userId,
      licenseNumber: FIXTURES.CLINICIAN_UNVERIFIED.licenseNumber,
      isVerified: FIXTURES.CLINICIAN_UNVERIFIED.isVerified,
      verificationStatus: FIXTURES.CLINICIAN_UNVERIFIED.verificationStatus,
      hasEmergencyAccessPermission: FIXTURES.CLINICIAN_UNVERIFIED.hasEmergencyAccessPermission,
    },
    create: {
      id: FIXTURES.CLINICIAN_UNVERIFIED.clinicianId,
      userId: FIXTURES.CLINICIAN_UNVERIFIED.userId,
      licenseNumber: FIXTURES.CLINICIAN_UNVERIFIED.licenseNumber,
      isVerified: FIXTURES.CLINICIAN_UNVERIFIED.isVerified,
      verificationStatus: FIXTURES.CLINICIAN_UNVERIFIED.verificationStatus,
      hasEmergencyAccessPermission: FIXTURES.CLINICIAN_UNVERIFIED.hasEmergencyAccessPermission,
    },
  });

  // Administrator
  await client.userAccount.upsert({
    where: { id: FIXTURES.ADMINISTRATOR.userId },
    update: { email: FIXTURES.ADMINISTRATOR.email, role: 'ADMIN', isActive: true },
    create: {
      id: FIXTURES.ADMINISTRATOR.userId,
      email: FIXTURES.ADMINISTRATOR.email,
      role: 'ADMIN',
      isActive: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Synthetic fixtures seeded successfully.');
}

seedFixtures()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

