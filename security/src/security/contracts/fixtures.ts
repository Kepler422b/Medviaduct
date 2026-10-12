/**
 * MediVault / Medviaduct - Synthetic Seed Fixtures
 *
 * NOTE ON CLINICIAN VERIFICATION:
 * Verification statuses in these fixtures are strictly seeded demo verification
 * flags for integration and security test purposes, NOT real-world medical license verifications.
 */

export const FIXTURES = {
  PATIENT_A: {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'patient.a@example.com',
    role: 'PATIENT' as const,
    patientId: '22222222-2222-4222-8222-222222222222',
    mrn: 'MRN-PATIENT-A',
  },
  PATIENT_B: {
    userId: '11111111-1111-4111-8111-111111111112',
    email: 'patient.b@example.com',
    role: 'PATIENT' as const,
    patientId: '22222222-2222-4222-8222-222222222223',
    mrn: 'MRN-PATIENT-B',
  },
  CLINICIAN_A: {
    userId: '33333333-3333-4333-8333-333333333331',
    email: 'clinician.a@example.com',
    role: 'CLINICIAN' as const,
    clinicianId: '44444444-4444-4444-8444-444444444441',
    licenseNumber: 'LIC-DEMO-VERIFIED-A',
    isVerified: true,
    verificationStatus: 'DEMO_VERIFIED', // Seeded demo verification only
    hasEmergencyAccessPermission: true, // Explicit server-provisioned emergency break-glass permission
  },
  CLINICIAN_B: {
    userId: '33333333-3333-4333-8333-333333333332',
    email: 'clinician.b@example.com',
    role: 'CLINICIAN' as const,
    clinicianId: '44444444-4444-4444-8444-444444444442',
    licenseNumber: 'LIC-DEMO-VERIFIED-B',
    isVerified: true,
    verificationStatus: 'DEMO_VERIFIED', // Seeded demo verification only
    hasEmergencyAccessPermission: false, // Verified but lacks server-provisioned emergency permission
  },
  CLINICIAN_UNVERIFIED: {
    userId: '33333333-3333-4333-8333-333333333333',
    email: 'clinician.unverified@example.com',
    role: 'CLINICIAN' as const,
    clinicianId: '44444444-4444-4444-8444-444444444443',
    licenseNumber: 'LIC-DEMO-UNVERIFIED',
    isVerified: false,
    verificationStatus: 'UNVERIFIED',
    hasEmergencyAccessPermission: false,
  },
  ADMINISTRATOR: {
    userId: '55555555-5555-4555-8555-555555555555',
    email: 'admin@example.com',
    role: 'ADMIN' as const,
  },
};
