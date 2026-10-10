import { IdentityRepository } from '../contracts/interfaces.js';
import {
  UserAccountRecord,
  PatientProfileRecord,
  ClinicianProfileRecord,
  UserRole,
} from '../contracts/types.js';

export interface SupabaseProfileRow {
  id: string;
  email?: string | null;
  role?: string | null;
  full_name?: string | null;
  license_number?: string | null;
  registration_number?: string | null;
  is_verified?: boolean | null;
  verification_status?: string | null;
  has_emergency_access_permission?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | Date | null;
}

export interface SupabasePatientRow {
  id: string;
  user_id?: string | null;
  patient_code: string;
  full_name?: string | null;
  date_of_birth?: string | null;
  sex?: string | null;
  created_at?: string | Date | null;
}

export interface QueryExecutor {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}

export interface SupabaseIdentityConfig {
  db?: QueryExecutor;
  supabaseUrl?: string;
  supabaseKey?: string;
  fetchFn?: typeof fetch;
}

/**
 * SupabaseIdentityRepository
 *
 * Implements IdentityRepository for production Supabase architecture.
 * Maps Supabase public.profiles (roles: clinician, patient, admin)
 * and public.patients (patient_code -> mrn) without altering the database schema.
 */
export class SupabaseIdentityRepository implements IdentityRepository {
  private readonly db?: QueryExecutor;
  private readonly supabaseUrl?: string;
  private readonly supabaseKey?: string;
  private readonly fetchFn: typeof fetch;

  constructor(config?: SupabaseIdentityConfig) {
    this.db = config?.db;
    this.supabaseUrl = (config?.supabaseUrl || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    this.supabaseKey = config?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    this.fetchFn = config?.fetchFn || fetch;
  }

  private normalizeRole(rawRole?: string | null): UserRole {
    const roleStr = (rawRole || '').trim().toLowerCase();
    if (roleStr === 'clinician') return 'CLINICIAN';
    if (roleStr === 'admin' || roleStr === 'administrator') return 'ADMIN';
    return 'PATIENT';
  }

  private mapUserAccount(profile: SupabaseProfileRow): UserAccountRecord {
    return {
      id: profile.id,
      email: profile.email || '',
      role: this.normalizeRole(profile.role),
      isActive: profile.is_active ?? true,
      createdAt: profile.created_at ? new Date(profile.created_at) : new Date(),
    };
  }

  private mapPatient(patient: SupabasePatientRow): PatientProfileRecord {
    return {
      id: patient.id,
      userId: patient.user_id || patient.id,
      mrn: patient.patient_code, // patient_code -> mrn mapping
      createdAt: patient.created_at ? new Date(patient.created_at) : new Date(),
    };
  }

  private mapClinician(profile: SupabaseProfileRow): ClinicianProfileRecord {
    const isVerified = Boolean(
      profile.is_verified ??
      (profile.verification_status === 'VERIFIED' || profile.verification_status === 'DEMO_VERIFIED')
    );

    return {
      id: profile.id,
      userId: profile.id,
      licenseNumber: profile.license_number || profile.registration_number || `LIC-${profile.id.substring(0, 8).toUpperCase()}`,
      isVerified,
      verificationStatus: profile.verification_status || (isVerified ? 'VERIFIED' : 'UNVERIFIED'),
      hasEmergencyAccessPermission: Boolean(profile.has_emergency_access_permission ?? false),
      createdAt: profile.created_at ? new Date(profile.created_at) : new Date(),
    };
  }

  async getUserAccount(userId: string): Promise<UserAccountRecord | null> {
    if (!userId) return null;

    if (this.db) {
      const res = await this.db.query<SupabaseProfileRow>(
        'SELECT id, email, role, is_active, created_at FROM public.profiles WHERE id = $1 LIMIT 1',
        [userId]
      );
      if (res.rows.length === 0) return null;
      return this.mapUserAccount(res.rows[0]);
    }

    if (this.supabaseUrl && this.supabaseKey) {
      try {
        const response = await this.fetchFn(
          `${this.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`,
          {
            headers: {
              apikey: this.supabaseKey,
              Authorization: `Bearer ${this.supabaseKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!response.ok) return null;
        const rows = (await response.json()) as SupabaseProfileRow[];
        if (!Array.isArray(rows) || rows.length === 0) return null;
        return this.mapUserAccount(rows[0]);
      } catch {
        return null;
      }
    }

    return null;
  }

  async getPatientByUserId(userId: string): Promise<PatientProfileRecord | null> {
    if (!userId) return null;

    if (this.db) {
      const res = await this.db.query<SupabasePatientRow>(
        'SELECT id, user_id, patient_code, created_at FROM public.patients WHERE user_id = $1 OR id = $1 LIMIT 1',
        [userId]
      );
      if (res.rows.length === 0) return null;
      return this.mapPatient(res.rows[0]);
    }

    if (this.supabaseUrl && this.supabaseKey) {
      try {
        const response = await this.fetchFn(
          `${this.supabaseUrl}/rest/v1/patients?or=(user_id.eq.${encodeURIComponent(userId)},id.eq.${encodeURIComponent(userId)})&select=*&limit=1`,
          {
            headers: {
              apikey: this.supabaseKey,
              Authorization: `Bearer ${this.supabaseKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!response.ok) return null;
        const rows = (await response.json()) as SupabasePatientRow[];
        if (!Array.isArray(rows) || rows.length === 0) return null;
        return this.mapPatient(rows[0]);
      } catch {
        return null;
      }
    }

    return null;
  }

  async getPatientById(patientId: string): Promise<PatientProfileRecord | null> {
    if (!patientId) return null;

    if (this.db) {
      const res = await this.db.query<SupabasePatientRow>(
        'SELECT id, user_id, patient_code, created_at FROM public.patients WHERE id = $1 LIMIT 1',
        [patientId]
      );
      if (res.rows.length === 0) return null;
      return this.mapPatient(res.rows[0]);
    }

    if (this.supabaseUrl && this.supabaseKey) {
      try {
        const response = await this.fetchFn(
          `${this.supabaseUrl}/rest/v1/patients?id=eq.${encodeURIComponent(patientId)}&select=*&limit=1`,
          {
            headers: {
              apikey: this.supabaseKey,
              Authorization: `Bearer ${this.supabaseKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!response.ok) return null;
        const rows = (await response.json()) as SupabasePatientRow[];
        if (!Array.isArray(rows) || rows.length === 0) return null;
        return this.mapPatient(rows[0]);
      } catch {
        return null;
      }
    }

    return null;
  }

  async getClinicianByUserId(userId: string): Promise<ClinicianProfileRecord | null> {
    if (!userId) return null;

    if (this.db) {
      const res = await this.db.query<SupabaseProfileRow>(
        'SELECT id, role, license_number, registration_number, is_verified, verification_status, has_emergency_access_permission, created_at FROM public.profiles WHERE id = $1 AND LOWER(role) = \'clinician\' LIMIT 1',
        [userId]
      );
      if (res.rows.length === 0) return null;
      return this.mapClinician(res.rows[0]);
    }

    if (this.supabaseUrl && this.supabaseKey) {
      try {
        const response = await this.fetchFn(
          `${this.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&role=ilike.clinician&select=*&limit=1`,
          {
            headers: {
              apikey: this.supabaseKey,
              Authorization: `Bearer ${this.supabaseKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!response.ok) return null;
        const rows = (await response.json()) as SupabaseProfileRow[];
        if (!Array.isArray(rows) || rows.length === 0) return null;
        return this.mapClinician(rows[0]);
      } catch {
        return null;
      }
    }

    return null;
  }

  async getClinicianById(clinicianId: string): Promise<ClinicianProfileRecord | null> {
    return this.getClinicianByUserId(clinicianId);
  }

  async listAvailableClinicians(): Promise<ClinicianProfileRecord[]> {
    if (this.db) {
      const res = await this.db.query<SupabaseProfileRow>(
        'SELECT id, role, license_number, registration_number, is_verified, verification_status, has_emergency_access_permission, created_at FROM public.profiles WHERE LOWER(role) = \'clinician\' AND (is_verified = true OR verification_status IN (\'VERIFIED\', \'DEMO_VERIFIED\')) ORDER BY created_at ASC'
      );
      return res.rows.map((row) => this.mapClinician(row));
    }

    if (this.supabaseUrl && this.supabaseKey) {
      try {
        const response = await this.fetchFn(
          `${this.supabaseUrl}/rest/v1/profiles?role=ilike.clinician&or=(is_verified.eq.true,verification_status.in.("VERIFIED","DEMO_VERIFIED"))&select=*`,
          {
            headers: {
              apikey: this.supabaseKey,
              Authorization: `Bearer ${this.supabaseKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!response.ok) return [];
        const rows = (await response.json()) as SupabaseProfileRow[];
        if (!Array.isArray(rows)) return [];
        return rows.map((row) => this.mapClinician(row));
      } catch {
        return [];
      }
    }

    return [];
  }
}
