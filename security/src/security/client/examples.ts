/**
 * MediVault / Medviaduct - Phase 6: Member 1 Frontend Usage Examples
 * HackMatrix 5.0 - Track 02 (HLTH-01)
 *
 * This file provides concrete, framework-agnostic component recipes for Member 1.
 * Adaptable directly into React, Vue, Svelte, or vanilla JavaScript.
 */

import {
  MediVaultSecurityClient,
  CreateConsentRequest,
  RequestEmergencyAccessInput,
} from './apiHelpers.js';
import { mapSecurityError, UserFriendlyError } from './errorMapping.js';

// ============================================================================
// 1. Memory-Only State Store (NEVER localStorage!)
// ============================================================================

export interface ActiveClinicalSessionState {
  activeGrantId: string | null;
  patientId: string | null;
  grantExpiresAt: string | null;
  clinicalRecords: unknown | null;
  isEmergency: boolean;
  emergencyNotice: string | null;
}

export class InMemoryClinicalStore {
  private state: ActiveClinicalSessionState = {
    activeGrantId: null,
    patientId: null,
    grantExpiresAt: null,
    clinicalRecords: null,
    isEmergency: false,
    emergencyNotice: null,
  };

  getState(): Readonly<ActiveClinicalSessionState> {
    return { ...this.state };
  }

  setGrant(grantId: string, patientId: string, expiresAt: string, isEmergency: boolean = false, notice: string | null = null) {
    this.state = {
      ...this.state,
      activeGrantId: grantId,
      patientId,
      grantExpiresAt: expiresAt,
      isEmergency,
      emergencyNotice: notice,
    };
  }

  setClinicalRecords(records: unknown) {
    this.state.clinicalRecords = records;
  }

  /**
   * CRITICAL SECURITY INVARIANT:
   * Wipe all clinical data, grants, and patient references immediately
   * upon logout, patient change, or when receiving a 401/403 access denial.
   */
  wipeState() {
    this.state = {
      activeGrantId: null,
      patientId: null,
      grantExpiresAt: null,
      clinicalRecords: null,
      isEmergency: false,
      emergencyNotice: null,
    };
  }
}

// ============================================================================
// 2. Patient Consent Panel Workflow
// ============================================================================

export async function runPatientConsentFlow(
  client: MediVaultSecurityClient,
  selectedClinicianId: string,
  durationMinutes: number = 30
): Promise<{ qrPayload: string; consentId: string; expiresAt: string }> {
  // 1. Create consent
  const consent = await client.createConsent({
    clinicianId: selectedClinicianId,
    scopes: ['timeline:read', 'clinical-summary:generate'],
    durationMinutes,
  });

  // 2. Generate single-use, 5-minute QR payload
  const qr = await client.generateQr(consent.id);

  // Return QR payload for rendering via QRCode SVG/Canvas component
  return {
    qrPayload: qr.payload, // e.g. "MEDVIADUCT:v1:<opaque_64_char_hex>"
    consentId: consent.id,
    expiresAt: qr.expiresAt,
  };
}

// ============================================================================
// 3. Clinician Scanner & Record Request Workflow (Camera or Manual Fallback)
// ============================================================================

export async function runClinicianResolutionFlow(
  client: MediVaultSecurityClient,
  store: InMemoryClinicalStore,
  scannedOrPastedPayload: string
): Promise<{ success: boolean; error?: UserFriendlyError }> {
  try {
    // 1. Resolve QR token into active Access Grant
    const grant = await client.resolveQr(scannedOrPastedPayload);

    // 2. Store grant reference in MEMORY ONLY
    store.setGrant(grant.accessGrantId, grant.patientId, grant.expiresAt, false);

    // 3. Request authorized clinical timeline attaching X-Access-Grant-Id
    const records = await client.fetchAuthorizedRecord(
      grant.patientId,
      grant.accessGrantId,
      'timeline'
    );

    store.setClinicalRecords(records);
    return { success: true };
  } catch (err) {
    const friendly = mapSecurityError(err);
    if (friendly.wipeClinicalData) {
      store.wipeState();
    }
    return { success: false, error: friendly };
  }
}

// ============================================================================
// 4. Emergency Break-Glass Panel Workflow (Eligible Clinicians)
// ============================================================================

export async function runEmergencyBreakGlassFlow(
  client: MediVaultSecurityClient,
  store: InMemoryClinicalStore,
  input: RequestEmergencyAccessInput
): Promise<{ success: boolean; notice?: string; error?: UserFriendlyError }> {
  try {
    // 1. Request emergency access override
    const emergencyRes = await client.requestEmergencyAccess(input);

    // 2. Store emergency grant reference with server-provided notice banner
    store.setGrant(
      emergencyRes.emergencyGrantId,
      emergencyRes.patientId,
      emergencyRes.expiresAt,
      true,
      emergencyRes.notice
    );

    // 3. Fetch bedside emergency clinical timeline
    const records = await client.fetchAuthorizedRecord(
      emergencyRes.patientId,
      emergencyRes.emergencyGrantId,
      'timeline'
    );

    store.setClinicalRecords(records);
    return { success: true, notice: emergencyRes.notice };
  } catch (err) {
    const friendly = mapSecurityError(err);
    if (friendly.wipeClinicalData) {
      store.wipeState();
    }
    return { success: false, error: friendly };
  }
}
