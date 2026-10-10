/**
 * MediVault / Medviaduct - Phase 6: Frontend Security API Client (Member 1)
 * HackMatrix 5.0 - Track 02 (HLTH-01)
 *
 * MANDATORY FRONTEND RULES FOR MEMBER 1:
 * 1. IN-MEMORY ONLY: Temporary accessGrantId, raw QR tokens, and clinical records
 *    MUST be kept strictly in application memory (React Context, Pinia, Vue reactive, Zustand).
 * 2. NO LOCALSTORAGE: NEVER store accessGrantId, raw QR tokens, or clinical records in localStorage/sessionStorage.
 * 3. STATE WIPE ON TRANSITIONS: Clear all in-memory grant, token, and clinical state immediately
 *    on user logout, account change, or navigating away from a patient view.
 * 4. INFORMATIONAL COUNTDOWNS: UI timers ("Expires in 14:32") are purely informational.
 *    The server clock is authoritative. Always handle 401 and 403 gracefully by clearing data.
 * 5. CAMERA FALLBACK: Always provide a manual text paste/type fallback for QR codes if the camera fails.
 * 6. TRANSPORT: Reuses Member 2's session/Bearer token transport. No second login mechanism!
 */

import { EmergencyReasonCode } from '../contracts/types.js';

export interface AvailableClinician {
  clinicianId: string;
  licenseNumber: string;
  isVerified: boolean;
  verificationStatus: string;
  hasEmergencyAccessPermission?: boolean;
}

export interface CreateConsentRequest {
  clinicianId: string;
  scopes: ('timeline:read' | 'clinical-summary:generate')[];
  durationMinutes?: number;
}

export interface ConsentDto {
  id: string;
  patientId: string;
  clinicianId: string;
  scopes: string[];
  status: 'active' | 'revoked';
  effectiveStatus: 'active' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface GenerateQrResponse {
  payload: string; // "MEDVIADUCT:v1:<64_hex_token>"
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
  reasonText: string;
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
  notice: string; // e.g. "Emergency access — audited — expires at ..."
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
  id?: string;
  patientId?: string;
  clinicianId?: string;
  revokedAt: string;
  status?: string;
  notice: string;
}

export interface SecurityApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
    internalReasonCode?: string;
  };
  status?: number;
}

export interface ClientConfig {
  baseUrl?: string;
  getAuthToken: () => string | null;
  csrfToken?: () => string | null;
}

export class MediVaultSecurityClient {
  private readonly baseUrl: string;
  private readonly getAuthToken: () => string | null;
  private readonly getCsrfToken?: () => string | null;

  constructor(config: ClientConfig | (() => string | null), legacyBaseUrl?: string) {
    if (typeof config === 'function') {
      this.getAuthToken = config;
      this.baseUrl = legacyBaseUrl ?? '/api';
    } else {
      this.baseUrl = config.baseUrl ?? '/api';
      this.getAuthToken = config.getAuthToken;
      this.getCsrfToken = config.csrfToken;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    customHeaders: Record<string, string> = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (this.getCsrfToken) {
      const csrf = this.getCsrfToken();
      if (csrf) {
        headers['X-CSRF-Token'] = csrf;
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: SecurityApiError;
      try {
        errorData = (await response.json()) as SecurityApiError;
        errorData.status = response.status;
      } catch {
        errorData = {
          status: response.status,
          error: {
            code: 'HTTP_ERROR',
            message: `Request failed with HTTP status ${response.status}`,
            requestId: response.headers.get('x-request-id') ?? 'unknown',
          },
        };
      }
      throw errorData;
    }

    return (await response.json()) as T;
  }

  // ==========================================================================
  // 1. Clinician Discovery
  // ==========================================================================

  /**
   * Retrieves verified clinicians available for selection in the patient consent panel.
   */
  async listAvailableClinicians(): Promise<AvailableClinician[]> {
    return this.request<AvailableClinician[]>('/clinicians', {
      method: 'GET',
    });
  }

  // ==========================================================================
  // 2. Normal Consent Workflow (Patient)
  // ==========================================================================

  /**
   * Patient: Creates a time-bounded, scoped consent for a verified clinician.
   */
  async createConsent(input: CreateConsentRequest): Promise<ConsentDto> {
    return this.request<ConsentDto>('/consents', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Patient: Lists all consents belonging to the authenticated patient.
   */
  async listConsents(): Promise<ConsentDto[]> {
    return this.request<ConsentDto[]>('/consents', {
      method: 'GET',
    });
  }

  /**
   * Patient: Instantly revokes an active consent.
   * Immediately invalidates any associated QR tokens and active grants.
   */
  async revokeConsent(consentId: string): Promise<ConsentDto> {
    return this.request<ConsentDto>(`/consents/${consentId}/revoke`, {
      method: 'POST',
    });
  }

  /**
   * Patient: Generates a single-use, 5-minute QR invitation payload for an active consent.
   */
  async generateQr(consentId: string): Promise<GenerateQrResponse> {
    return this.request<GenerateQrResponse>('/qr/generate', {
      method: 'POST',
      body: JSON.stringify({ consentId }),
    });
  }

  // ==========================================================================
  // 3. QR Resolution Workflow (Clinician)
  // ==========================================================================

  /**
   * Clinician: Resolves a scanned or manually typed QR code into an active Access Grant.
   */
  async resolveQr(token: string): Promise<ResolveQrResponse> {
    return this.request<ResolveQrResponse>('/qr/resolve', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // ==========================================================================
  // 4. Emergency Break-Glass Workflow (Eligible Clinicians)
  // ==========================================================================

  /**
   * Clinician: Declares emergency access with mandatory reasonCode and clinical justification.
   * Produces a server-bounded 5-minute emergency access grant with fixed timeline:read scope.
   */
  async requestEmergencyAccess(input: RequestEmergencyAccessInput): Promise<EmergencyAccessResponse> {
    return this.request<EmergencyAccessResponse>('/emergency-access', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Clinician / Patient: Lists active/past emergency grants.
   * - Clinicians see their own declared emergency grants.
   * - Patients see safe audit metadata of emergency overrides on their own record.
   * - Administrators are denied.
   */
  async listEmergencyAccess(): Promise<SafeEmergencyGrantMetadata[]> {
    return this.request<SafeEmergencyGrantMetadata[]>('/emergency-access', {
      method: 'GET',
    });
  }

  /**
   * Clinician or Patient: Early-revokes an active emergency access grant.
   */
  async revokeEmergencyAccess(grantId: string): Promise<RevokeEmergencyResponse> {
    return this.request<RevokeEmergencyResponse>(`/emergency-access/${grantId}/revoke`, {
      method: 'POST',
    });
  }

  // ==========================================================================
  // 5. Authorized Record Requests (Attaching Grant Reference)
  // ==========================================================================

  /**
   * Clinician: Requests an authorized patient record (timeline, encounter, medications)
   * attaching the required X-Access-Grant-Id header.
   */
  async fetchAuthorizedRecord<T = unknown>(
    patientId: string,
    accessGrantId: string,
    subPath: string = 'timeline'
  ): Promise<T> {
    const cleanSubPath = subPath.startsWith('/') ? subPath.slice(1) : subPath;
    return this.request<T>(
      `/patients/${patientId}/${cleanSubPath}`,
      { method: 'GET' },
      { 'X-Access-Grant-Id': accessGrantId }
    );
  }

  /**
   * Helper alias for timeline fetch.
   */
  async fetchAuthorizedTimeline<TTimeline = unknown>(
    patientId: string,
    accessGrantId: string
  ): Promise<TTimeline> {
    return this.fetchAuthorizedRecord<TTimeline>(patientId, accessGrantId, 'timeline');
  }
}
