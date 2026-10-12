import { describe, it, expect, vi } from 'vitest';
import {
  SupabaseIdentityRepository,
  QueryExecutor,
} from '../src/security/repositories/supabaseIdentityRepository.js';

describe('SupabaseIdentityRepository Unit & Mapping Tests', () => {
  const dummyUrl = 'https://mock-supabase.co';
  const dummyKey = 'mock-service-key';

  describe('Database (QueryExecutor) Adapter Mode', () => {
    it('maps public.profiles role to uppercase UserRole correctly', async () => {
      const mockDb: QueryExecutor = {
        query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
          if (params[0] === 'user-clinician-1') {
            return {
              rows: [
                {
                  id: 'user-clinician-1',
                  email: 'doctor@hospital.org',
                  role: 'clinician',
                  is_active: true,
                  created_at: '2026-01-01T00:00:00.000Z',
                },
              ],
            };
          }
          if (params[0] === 'user-admin-1') {
            return {
              rows: [
                {
                  id: 'user-admin-1',
                  email: 'admin@publichealth.gov',
                  role: 'admin',
                  is_active: true,
                  created_at: '2026-01-01T00:00:00.000Z',
                },
              ],
            };
          }
          return {
            rows: [
              {
                id: 'user-patient-1',
                email: 'patient@example.com',
                role: 'patient',
                is_active: true,
                created_at: '2026-01-01T00:00:00.000Z',
              },
            ],
          };
        }),
      };

      const repo = new SupabaseIdentityRepository({ db: mockDb });

      const clinicianUser = await repo.getUserAccount('user-clinician-1');
      expect(clinicianUser).not.toBeNull();
      expect(clinicianUser?.role).toBe('CLINICIAN');
      expect(clinicianUser?.email).toBe('doctor@hospital.org');

      const adminUser = await repo.getUserAccount('user-admin-1');
      expect(adminUser?.role).toBe('ADMIN');

      const patientUser = await repo.getUserAccount('user-patient-1');
      expect(patientUser?.role).toBe('PATIENT');
    });

    it('maps public.patients patient_code -> mrn without schema modification', async () => {
      const mockDb: QueryExecutor = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'pat-uuid-1234',
              user_id: 'user-uuid-1234',
              patient_code: 'MV-MRN-987654',
              created_at: '2026-02-15T08:30:00.000Z',
            },
          ],
        }),
      };

      const repo = new SupabaseIdentityRepository({ db: mockDb });

      const patientByUserId = await repo.getPatientByUserId('user-uuid-1234');
      expect(patientByUserId).not.toBeNull();
      expect(patientByUserId?.id).toBe('pat-uuid-1234');
      expect(patientByUserId?.userId).toBe('user-uuid-1234');
      expect(patientByUserId?.mrn).toBe('MV-MRN-987654'); // patient_code -> mrn mapped

      const patientById = await repo.getPatientById('pat-uuid-1234');
      expect(patientById?.mrn).toBe('MV-MRN-987654');
    });

    it('retrieves clinician profile with license and verification status', async () => {
      const mockDb: QueryExecutor = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'clinician-uuid-555',
              role: 'clinician',
              license_number: 'MCI-2024-998811',
              is_verified: true,
              verification_status: 'DEMO_VERIFIED',
              has_emergency_access_permission: true,
              created_at: '2026-03-01T10:00:00.000Z',
            },
          ],
        }),
      };

      const repo = new SupabaseIdentityRepository({ db: mockDb });

      const clinician = await repo.getClinicianById('clinician-uuid-555');
      expect(clinician).not.toBeNull();
      expect(clinician?.licenseNumber).toBe('MCI-2024-998811');
      expect(clinician?.isVerified).toBe(true);
      expect(clinician?.verificationStatus).toBe('DEMO_VERIFIED');
      expect(clinician?.hasEmergencyAccessPermission).toBe(true);
    });

    it('lists available verified clinicians', async () => {
      const mockDb: QueryExecutor = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'doc-1',
              role: 'clinician',
              license_number: 'LIC-001',
              is_verified: true,
              verification_status: 'VERIFIED',
              has_emergency_access_permission: true,
            },
            {
              id: 'doc-2',
              role: 'clinician',
              license_number: 'LIC-002',
              is_verified: true,
              verification_status: 'DEMO_VERIFIED',
              has_emergency_access_permission: false,
            },
          ],
        }),
      };

      const repo = new SupabaseIdentityRepository({ db: mockDb });
      const clinicians = await repo.listAvailableClinicians();
      expect(clinicians).toHaveLength(2);
      expect(clinicians[0].id).toBe('doc-1');
      expect(clinicians[1].id).toBe('doc-2');
    });
  });

  describe('REST API (PostgREST) Mode', () => {
    it('queries Supabase REST API and maps user profile', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 'rest-user-1',
            email: 'rest.user@test.org',
            role: 'clinician',
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const repo = new SupabaseIdentityRepository({
        supabaseUrl: dummyUrl,
        supabaseKey: dummyKey,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const user = await repo.getUserAccount('rest-user-1');
      expect(user).not.toBeNull();
      expect(user?.role).toBe('CLINICIAN');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rest/v1/profiles?id=eq.rest-user-1'),
        expect.objectContaining({
          headers: expect.objectContaining({
            apikey: dummyKey,
            Authorization: `Bearer ${dummyKey}`,
          }),
        })
      );
    });

    it('queries Supabase REST API and maps patient with patient_code -> mrn', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 'rest-pat-1',
            user_id: 'rest-user-pat',
            patient_code: 'REST-CODE-777',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const repo = new SupabaseIdentityRepository({
        supabaseUrl: dummyUrl,
        supabaseKey: dummyKey,
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const patient = await repo.getPatientById('rest-pat-1');
      expect(patient).not.toBeNull();
      expect(patient?.mrn).toBe('REST-CODE-777');
    });
  });
});
