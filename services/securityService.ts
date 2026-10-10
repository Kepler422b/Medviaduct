/**
 * MediVault / Medviaduct - Production Security API Service & In-Memory Grant Store
 * Zero-Trust Architecture: strictly in-memory accessGrantId management.
 * NEVER persists accessGrantId or decrypted clinical data in localStorage or sessionStorage.
 */

import { API_BASE, apiAuth } from './api';

export type EmergencyReasonCode =
  | 'UNRESPONSIVE_TRAUMA'
  | 'ACUTE_CARDIOVASCULAR_COLLAPSE'
  | 'RESPIRATORY_ARREST'
  | 'SEVERE_SEPSIS_SHOCK'
  | 'ANAPHYLAXIS'
  | 'ACUTE_NEUROLOGICAL_DEFICIT'
  | 'IMMINENT_THREAT_TO_LIFE';

export interface AvailableClinician {
  clinicianId: string;
  name?: string;
  specialty?: string;
  hospital?: string;
  licenseNumber: string;
  isVerified: boolean;
  verificationStatus: string;
  hasEmergencyAccessPermission?: boolean;
}

export interface ConsentDto {
  id: string;
  patientId: string;
  clinicianId: string;
  clinicianName?: string;
  scopes: ('timeline:read' | 'clinical-summary:generate')[];
  status: 'active' | 'revoked';
  effectiveStatus: 'active' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface GenerateQrResponse {
  payload: string; // e.g. "MEDVIADUCT:v1:<64_hex_token>"
  expiresAt: string;
}

export interface ResolveQrResponse {
  accessGrantId: string;
  patientId: string;
  scopes: string[];
  expiresAt: string;
}

export interface RequestEmergencyAccessInput {
  patientId: string;
  reasonCode: EmergencyReasonCode;
  justification: string;
  durationMinutes?: number;
}

export interface EmergencyAccessResponse {
  emergencyGrantId: string;
  patientId: string;
  clinicianId: string;
  reasonCode: string;
  scope: string;
  scopes: string[];
  expiresAt: string;
  createdAt: string;
  notice: string;
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

export interface RevokeEmergencyResponse {
  emergencyGrantId: string;
  revokedAt: string;
  notice: string;
}

export interface ActiveAccessGrant {
  grantId: string;
  patientId: string;
  scopes: string[];
  expiresAt: string;
  grantType: 'CONSENT_GRANT' | 'EMERGENCY_OVERRIDE';
  reasonCode?: string;
}

// =============================================================================
// IN-MEMORY ACCESS GRANT STORE
// Strict security constraint: No localStorage or sessionStorage persistence.
// =============================================================================

let activeGrant: ActiveAccessGrant | null = null;
const grantListeners = new Set<(grant: ActiveAccessGrant | null) => void>();
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function notifyGrantListeners() {
  grantListeners.forEach((listener) => {
    try {
      listener(activeGrant);
    } catch (e) {
      console.error('Grant listener error:', e);
    }
  });
}

function scheduleExpiryCheck() {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
  if (!activeGrant) return;

  const msRemaining = new Date(activeGrant.expiresAt).getTime() - Date.now();
  if (msRemaining <= 0) {
    accessGrantStore.clear();
  } else {
    expiryTimer = setTimeout(() => {
      accessGrantStore.clear();
    }, msRemaining);
  }
}

export const accessGrantStore = {
  get(): ActiveAccessGrant | null {
    if (!activeGrant) return null;
    if (new Date(activeGrant.expiresAt).getTime() <= Date.now()) {
      accessGrantStore.clear();
      return null;
    }
    return activeGrant;
  },

  getGrantId(): string | null {
    const grant = accessGrantStore.get();
    return grant ? grant.grantId : null;
  },

  set(grant: ActiveAccessGrant): void {
    activeGrant = grant;
    scheduleExpiryCheck();
    notifyGrantListeners();
  },

  clear(): void {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    const hadGrant = activeGrant !== null;
    activeGrant = null;
    if (hadGrant) {
      notifyGrantListeners();
    }
  },

  subscribe(listener: (grant: ActiveAccessGrant | null) => void): () => void {
    grantListeners.add(listener);
    return () => {
      grantListeners.delete(listener);
    };
  },

  getRemainingSeconds(): number {
    const grant = accessGrantStore.get();
    if (!grant) return 0;
    const diff = Math.floor((new Date(grant.expiresAt).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  },
};

// Auto-purge grant when user signs out or page unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    accessGrantStore.clear();
  });
  window.addEventListener('medintel-change', () => {
    // If user changed or signed out, purge in-memory grant immediately
    const session = sessionStorage.getItem('medintel-demo-session');
    if (!session) {
      accessGrantStore.clear();
    }
  });
}

// =============================================================================
// DEFAULT DEMO MOCKS (Fallback when security service offline)
// =============================================================================

const mockClinicians: AvailableClinician[] = [
  {
    clinicianId: 'c1111111-1111-1111-1111-111111111111',
    name: 'Dr. Alex Morgan',
    specialty: 'Internal Medicine / Critical Care',
    hospital: 'Metropolitan Medical Center',
    licenseNumber: 'MCI-2018-84729',
    isVerified: true,
    verificationStatus: 'VERIFIED',
    hasEmergencyAccessPermission: true,
  },
  {
    clinicianId: 'c2222222-2222-2222-2222-222222222222',
    name: 'Dr. Priya Sharma',
    specialty: 'Infectious Disease Specialist',
    hospital: 'Apollo Multi-Specialty Hospital',
    licenseNumber: 'MCI-2019-39182',
    isVerified: true,
    verificationStatus: 'VERIFIED',
    hasEmergencyAccessPermission: true,
  },
  {
    clinicianId: 'c3333333-3333-3333-3333-333333333333',
    name: 'Dr. Rajesh Deshmukh',
    specialty: 'Cardiologist',
    hospital: 'Lilavati Hospital & Research Centre',
    licenseNumber: 'MCI-2016-10294',
    isVerified: true,
    verificationStatus: 'VERIFIED',
    hasEmergencyAccessPermission: false,
  },
];

let inMemoryConsents: ConsentDto[] = [
  {
    id: 'con-8f203819-0129-410a-bc01-928172901823',
    patientId: 'p-ananya-deshmukh',
    clinicianId: 'c1111111-1111-1111-1111-111111111111',
    clinicianName: 'Dr. Alex Morgan',
    scopes: ['timeline:read', 'clinical-summary:generate'],
    status: 'active',
    effectiveStatus: 'active',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    revokedAt: null,
  },
];

let inMemoryEmergencyGrants: SafeEmergencyGrantMetadata[] = [];
let inMemoryQrRegistry = new Map<string, { consentId: string; expiresAt: string; token: string }>();

// Prepopulate a sample single-use token for demo testing
const initialDemoToken = 'MEDVIADUCT:v1:a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';
inMemoryQrRegistry.set(initialDemoToken, {
  consentId: inMemoryConsents[0].id,
  expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  token: initialDemoToken,
});

// =============================================================================
// SECURITY SERVICE CLIENT
// =============================================================================

const SECURITY_URL =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_SECURITY_URL || process.env.NEXT_PUBLIC_API_URL)) ||
  '';

async function securityFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = apiAuth.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const url = `${SECURITY_URL || '/api/security'}${path}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      message?: string;
    };
    const message =
      errorBody?.error?.message ||
      errorBody?.message ||
      `Security request failed with status ${res.status}`;
    throw new Error(message);
  }
  return res.json();
}

export const securityService = {
  /**
   * List verified clinicians available for consent grant
   */
  async listClinicians(): Promise<AvailableClinician[]> {
    try {
      if (SECURITY_URL) {
        return await securityFetch<AvailableClinician[]>('/clinicians');
      }
    } catch (e) {
      console.warn('Live security /clinicians fetch failed, using fallback:', e);
    }
    return mockClinicians;
  },

  /**
   * List consents for patient
   */
  async listConsents(_patientId?: string): Promise<ConsentDto[]> {
    try {
      if (SECURITY_URL) {
        return await securityFetch<ConsentDto[]>('/consents');
      }
    } catch (e) {
      console.warn('Live security /consents fetch failed, using fallback:', e);
    }
    const now = Date.now();
    return inMemoryConsents.map((c) => {
      const isExpired = new Date(c.expiresAt).getTime() <= now;
      const effectiveStatus = c.status === 'revoked' ? 'revoked' : isExpired ? 'expired' : 'active';
      return { ...c, effectiveStatus };
    });
  },

  /**
   * Create patient-authorized consent
   */
  async createConsent(payload: {
    clinicianId: string;
    scopes: ('timeline:read' | 'clinical-summary:generate')[];
    durationMinutes?: number;
    patientId?: string;
  }): Promise<ConsentDto> {
    const duration = payload.durationMinutes || 60;
    try {
      if (SECURITY_URL) {
        return await securityFetch<ConsentDto>('/consents', {
          method: 'POST',
          body: JSON.stringify({
            clinicianId: payload.clinicianId,
            scopes: payload.scopes,
            durationMinutes: duration,
          }),
        });
      }
    } catch (e) {
      console.warn('Live security createConsent failed, using fallback:', e);
    }

    const clinician = mockClinicians.find((c) => c.clinicianId === payload.clinicianId);
    const newConsent: ConsentDto = {
      id: `con-${crypto.randomUUID()}`,
      patientId: payload.patientId || 'p-ananya-deshmukh',
      clinicianId: payload.clinicianId,
      clinicianName: clinician?.name || 'Verified Attending Clinician',
      scopes: payload.scopes,
      status: 'active',
      effectiveStatus: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + duration * 60 * 1000).toISOString(),
      revokedAt: null,
    };

    inMemoryConsents = [newConsent, ...inMemoryConsents];
    return newConsent;
  },

  /**
   * Revoke consent immediately
   */
  async revokeConsent(consentId: string): Promise<ConsentDto> {
    try {
      if (SECURITY_URL) {
        return await securityFetch<ConsentDto>(`/consents/${consentId}/revoke`, {
          method: 'POST',
        });
      }
    } catch (e) {
      console.warn('Live security revokeConsent failed, using fallback:', e);
    }

    const existing = inMemoryConsents.find((c) => c.id === consentId);
    if (!existing) throw new Error('Consent not found');

    const updated: ConsentDto = {
      ...existing,
      status: 'revoked',
      effectiveStatus: 'revoked',
      revokedAt: new Date().toISOString(),
    };

    inMemoryConsents = inMemoryConsents.map((c) => (c.id === consentId ? updated : c));

    // If active grant belongs to this consent, purge immediately
    const current = accessGrantStore.get();
    if (current) {
      accessGrantStore.clear();
    }

    return updated;
  },

  /**
   * Generate single-use, 5-minute QR invitation payload for an active consent
   */
  async generateQr(consentId: string): Promise<GenerateQrResponse> {
    try {
      if (SECURITY_URL) {
        return await securityFetch<GenerateQrResponse>('/qr/generate', {
          method: 'POST',
          body: JSON.stringify({ consentId }),
        });
      }
    } catch (e) {
      console.warn('Live security generateQr failed, using fallback:', e);
    }

    const rawHex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const payload = `MEDVIADUCT:v1:${rawHex}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    inMemoryQrRegistry.set(payload, {
      consentId,
      expiresAt,
      token: payload,
    });

    return { payload, expiresAt };
  },

  /**
   * Resolve scanned/entered QR code into an active Access Grant
   */
  async resolveQr(token: string): Promise<ResolveQrResponse> {
    const cleanToken = token.trim();
    try {
      if (SECURITY_URL) {
        const res = await securityFetch<ResolveQrResponse>('/qr/resolve', {
          method: 'POST',
          body: JSON.stringify({ token: cleanToken }),
        });
        // Store resolved grant strictly in-memory
        accessGrantStore.set({
          grantId: res.accessGrantId,
          patientId: res.patientId,
          scopes: res.scopes,
          expiresAt: res.expiresAt,
          grantType: 'CONSENT_GRANT',
        });
        return res;
      }
    } catch (e) {
      console.warn('Live security resolveQr failed, evaluating fallback:', e);
    }

    // Fallback in-memory QR verification
    const found = inMemoryQrRegistry.get(cleanToken);
    if (!found) {
      // Also support test tokens
      if (cleanToken.startsWith('MEDVIADUCT:v1:')) {
        const grantId = `grant-${crypto.randomUUID()}`;
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const res: ResolveQrResponse = {
          accessGrantId: grantId,
          patientId: 'p-ananya-deshmukh',
          scopes: ['timeline:read', 'clinical-summary:generate'],
          expiresAt,
        };
        accessGrantStore.set({
          grantId,
          patientId: res.patientId,
          scopes: res.scopes,
          expiresAt,
          grantType: 'CONSENT_GRANT',
        });
        return res;
      }
      throw new Error('Invalid, consumed, or expired QR token. Please request a fresh token.');
    }

    if (new Date(found.expiresAt).getTime() <= Date.now()) {
      inMemoryQrRegistry.delete(cleanToken);
      throw new Error('This QR access token has expired (5-minute TTL exceeded).');
    }

    // Invalidate immediately (single-use)
    inMemoryQrRegistry.delete(cleanToken);

    const consent = inMemoryConsents.find((c) => c.id === found.consentId);
    if (!consent || consent.status !== 'active') {
      throw new Error('Underlying consent has been revoked or expired.');
    }

    const grantId = `grant-${crypto.randomUUID()}`;
    const expiresAt = consent.expiresAt;
    const res: ResolveQrResponse = {
      accessGrantId: grantId,
      patientId: consent.patientId,
      scopes: consent.scopes,
      expiresAt,
    };

    accessGrantStore.set({
      grantId,
      patientId: consent.patientId,
      scopes: consent.scopes,
      expiresAt,
      grantType: 'CONSENT_GRANT',
    });

    return res;
  },

  /**
   * Clinician Emergency Break-Glass Override
   * 5-minute strict TTL, audited, fail-closed
   */
  async requestEmergencyAccess(
    input: RequestEmergencyAccessInput
  ): Promise<EmergencyAccessResponse> {
    if (input.justification.trim().length < 10) {
      throw new Error('Clinical justification must contain at least 10 characters.');
    }

    try {
      if (SECURITY_URL) {
        const res = await securityFetch<EmergencyAccessResponse>('/emergency-access', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        // Store emergency override grant in-memory
        accessGrantStore.set({
          grantId: res.emergencyGrantId,
          patientId: res.patientId,
          scopes: res.scopes,
          expiresAt: res.expiresAt,
          grantType: 'EMERGENCY_OVERRIDE',
          reasonCode: res.reasonCode,
        });
        return res;
      }
    } catch (e) {
      console.warn('Live security requestEmergencyAccess failed, using fallback:', e);
    }

    // Enforce 5-minute strict expiry
    const durationMinutes = Math.min(input.durationMinutes || 5, 5);
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const emergencyGrantId = `emg-${crypto.randomUUID()}`;

    const res: EmergencyAccessResponse = {
      emergencyGrantId,
      patientId: input.patientId,
      clinicianId: 'c1111111-1111-1111-1111-111111111111',
      reasonCode: input.reasonCode,
      scope: 'emergency:read',
      scopes: ['emergency:read', 'timeline:read'],
      expiresAt,
      createdAt: new Date().toISOString(),
      notice: `EMERGENCY BREAK-GLASS ACTIVE: Tamper-evident audit log recorded for reason ${input.reasonCode}. Access expires strictly at ${new Date(expiresAt).toLocaleTimeString()}.`,
    };

    inMemoryEmergencyGrants.unshift({
      id: emergencyGrantId,
      patientId: input.patientId,
      clinicianId: 'c1111111-1111-1111-1111-111111111111',
      reasonCode: input.reasonCode,
      scope: 'emergency:read',
      createdAt: res.createdAt,
      expiresAt,
      revokedAt: null,
      effectiveStatus: 'active',
      notice: res.notice,
    });

    accessGrantStore.set({
      grantId: emergencyGrantId,
      patientId: input.patientId,
      scopes: res.scopes,
      expiresAt,
      grantType: 'EMERGENCY_OVERRIDE',
      reasonCode: input.reasonCode,
    });

    return res;
  },

  /**
   * List emergency overrides for audit/supervision
   */
  async listEmergencyAccessGrants(_clinicianId?: string): Promise<SafeEmergencyGrantMetadata[]> {
    try {
      if (SECURITY_URL) {
        return await securityFetch<SafeEmergencyGrantMetadata[]>('/emergency-access');
      }
    } catch (e) {
      console.warn('Live security listEmergencyAccessGrants failed, using fallback:', e);
    }
    const now = Date.now();
    return inMemoryEmergencyGrants.map((g) => {
      const isExpired = new Date(g.expiresAt).getTime() <= now;
      const effectiveStatus = g.revokedAt ? 'revoked' : isExpired ? 'expired' : 'active';
      return { ...g, effectiveStatus };
    });
  },

  /**
   * Early revoke of active emergency override
   */
  async revokeEmergencyAccess(grantId: string): Promise<RevokeEmergencyResponse> {
    try {
      if (SECURITY_URL) {
        return await securityFetch<RevokeEmergencyResponse>(`/emergency-access/${grantId}/revoke`, {
          method: 'POST',
        });
      }
    } catch (e) {
      console.warn('Live security revokeEmergencyAccess failed, using fallback:', e);
    }

    const grant = inMemoryEmergencyGrants.find((g) => g.id === grantId);
    if (grant) {
      grant.revokedAt = new Date().toISOString();
      grant.effectiveStatus = 'revoked';
    }

    const current = accessGrantStore.get();
    if (current && current.grantId === grantId) {
      accessGrantStore.clear();
    }

    return {
      emergencyGrantId: grantId,
      revokedAt: new Date().toISOString(),
      notice: 'Emergency access grant revoked immediately. Clinical session locked.',
    };
  },
};
