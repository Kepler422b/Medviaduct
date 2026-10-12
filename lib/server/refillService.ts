// lib/server/refillService.ts
/**
 * Medviaduct Prescription Refill Management Service
 *
 * Implements server-side validation, duplicate prevention, pharmacy routing,
 * and n8n webhook notification dispatch for medication refill requests.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { AuthUser } from './auth';
import { patientService } from '@/services/patientService';
import { pharmacyDirectory } from './pharmacyDirectory';
import { n8nService, getEnvConfig } from './n8nService';
import { recordAudit } from './audit';

export interface RefillRequest {
  requestId: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  prescriptionId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  requestedQuantity: number;
  refillsRemainingBefore: number;
  refillsRemainingAfter: number;
  pharmacyId: string;
  pharmacyName: string;
  pharmacyEmail: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'DISPENSED' | 'REJECTED';
  notificationStatus: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  requestedAt: string;
  disclaimer: string;
}

const REFILL_STORAGE_FILE = path.join(process.cwd(), '.medviaduct_refills.json');
const DUPLICATE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes duplicate protection window

const refillStore = new Map<string, RefillRequest>();

function saveRefillsToDisk() {
  try {
    const list = Array.from(refillStore.values());
    fs.writeFileSync(REFILL_STORAGE_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {}
}

function loadRefillsFromDisk() {
  try {
    if (fs.existsSync(REFILL_STORAGE_FILE)) {
      const data = fs.readFileSync(REFILL_STORAGE_FILE, 'utf-8');
      const list: RefillRequest[] = JSON.parse(data);
      for (const item of list) {
        refillStore.set(item.requestId, item);
      }
    }
  } catch {}
}

loadRefillsFromDisk();

export const refillService = {
  /**
   * Submit and persist a refill request.
   * Enforces zero-trust server validation:
   * - Identifies patient strictly from session
   * - Validates prescription ownership, active status, and remaining refills
   * - Ignores any client-supplied pharmacy email
   * - Prevents duplicate requests
   */
  async createRefillRequest(params: {
    actor: AuthUser;
    prescriptionId: string;
    requestedQuantity?: number;
    pharmacyId?: string;
    // Ignored if provided by client
    clientPharmacyEmail?: string;
    clientIp?: string;
  }): Promise<{ success: boolean; request?: RefillRequest; error?: string; statusCode?: number }> {
    const { actor, prescriptionId } = params;
    const clientIp = params.clientIp || '127.0.0.1';

    // 1. Session check: Only patients can request refills for themselves
    if (actor.role !== 'PATIENT' || !actor.domainId) {
      return {
        success: false,
        error: 'Only authenticated patients can submit prescription refill requests.',
        statusCode: 403
      };
    }

    const patientId = actor.domainId;

    // 2. Fetch patient bundle from server
    let bundle;
    try {
      bundle = patientService.getBundle(patientId);
    } catch {
      return {
        success: false,
        error: `Patient profile '${patientId}' not found.`,
        statusCode: 404
      };
    }

    // 3. Find prescription in patient's active records
    const prescription = bundle.prescriptions.find((p) => p.id === prescriptionId);
    if (!prescription) {
      // Prescription does not belong to this patient -> IDOR rejection
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        actorName: actor.name,
        targetPatientId: patientId,
        action: 'UNAUTHORIZED_ACCESS_DENIED',
        resourceName: 'prescription_refill',
        outcome: 'DENY',
        reasonCode: 'REFILL_IDOR_VIOLATION',
        clientIp,
        requestId: `refill-idor-${Date.now()}`,
        metadata: { prescriptionId, patientId }
      });

      return {
        success: false,
        error: 'Prescription not found or does not belong to the authenticated patient.',
        statusCode: 404
      };
    }

    // 4. Validate prescription constraints
    if (prescription.status !== 'Active') {
      return {
        success: false,
        error: `Cannot request refill for medication '${prescription.medicationName}' with status '${prescription.status}'. Only Active prescriptions are eligible.`,
        statusCode: 400
      };
    }

    if (prescription.refillsRemaining <= 0) {
      return {
        success: false,
        error: `Cannot request refill: 0 refills remaining for '${prescription.medicationName}'. A new clinical consultation is required.`,
        statusCode: 400
      };
    }

    // 5. Prevent duplicate requests (repeated clicks or active pending request)
    const now = Date.now();
    const existingPending = Array.from(refillStore.values()).find(
      (r) =>
        r.patientId === patientId &&
        r.prescriptionId === prescriptionId &&
        r.status === 'PENDING_REVIEW' &&
        now - new Date(r.requestedAt).getTime() < DUPLICATE_COOLDOWN_MS
    );

    if (existingPending) {
      return {
        success: false,
        error: `A refill request for '${prescription.medicationName}' was already submitted at ${new Date(existingPending.requestedAt).toLocaleTimeString()} and is currently pending pharmacy review.`,
        statusCode: 409
      };
    }

    // 6. Resolve destination pharmacy through trusted server directory (ignoring any client-supplied email)
    const resolvedPharmacy = params.pharmacyId
      ? pharmacyDirectory.getPharmacyById(params.pharmacyId) || pharmacyDirectory.getDefaultPharmacyForPatient(patientId)
      : pharmacyDirectory.getDefaultPharmacyForPatient(patientId);

    // 7. Calculate quantities and remaining refills
    const requestedQuantity = params.requestedQuantity || 30; // default 30-day supply
    const refillsRemainingBefore = prescription.refillsRemaining;
    const refillsRemainingAfter = Math.max(0, refillsRemainingBefore - 1);

    const requestId = `refill-req-${randomUUID().slice(0, 12)}`;
    const requestedAt = new Date().toISOString();

    // Patient email: verified email from seeded account or bundle profile
    const verifiedPatientEmail =
      getEnvConfig('VERIFIED_PATIENT_EMAIL') ||
      actor.email ||
      bundle.profile.email ||
      'patient@medviaduct.org';

    const disclaimer =
      'PENDING PHARMACY REVIEW: This notification is an electronic refill inquiry and does not constitute a dispensing authorization or clinical guarantee of stock availability.';

    const newRequest: RefillRequest = {
      requestId,
      patientId,
      patientName: bundle.profile.name,
      patientEmail: verifiedPatientEmail,
      patientPhone: bundle.profile.phone,
      prescriptionId: prescription.id,
      medicationName: prescription.medicationName,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      requestedQuantity,
      refillsRemainingBefore,
      refillsRemainingAfter,
      pharmacyId: resolvedPharmacy.id,
      pharmacyName: resolvedPharmacy.name,
      pharmacyEmail: resolvedPharmacy.notificationEmail,
      status: 'PENDING_REVIEW',
      notificationStatus: 'PENDING',
      requestedAt,
      disclaimer
    };

    // 8. Persist refill request before triggering webhook
    refillStore.set(requestId, newRequest);
    saveRefillsToDisk();

    // Update the in-memory prescription's refillsRemaining
    prescription.refillsRemaining = refillsRemainingAfter;

    // 9. Dispatch refill event to n8n outbox
    const outboxRecord = await n8nService.enqueueRefillEvent({
      requestId,
      eventType: 'prescription.refill.requested',
      patientId,
      patientName: newRequest.patientName,
      patientEmail: newRequest.patientEmail,
      patientPhone: newRequest.patientPhone,
      prescriptionId: newRequest.prescriptionId,
      medicationName: newRequest.medicationName,
      dosage: newRequest.dosage,
      requestedQuantity: newRequest.requestedQuantity,
      refillsRemaining: newRequest.refillsRemainingAfter,
      pharmacyId: newRequest.pharmacyId,
      pharmacyName: newRequest.pharmacyName,
      pharmacyEmail: newRequest.pharmacyEmail,
      requestedAt: newRequest.requestedAt,
      status: 'pending_pharmacy_review',
      disclaimer: newRequest.disclaimer
    });

    if (outboxRecord.status === 'DELIVERED') {
      newRequest.notificationStatus = 'SENT';
    } else if (outboxRecord.status === 'SKIPPED_UNCONFIGURED') {
      newRequest.notificationStatus = 'SKIPPED';
    } else {
      newRequest.notificationStatus = 'PENDING';
    }

    saveRefillsToDisk();

    // 10. Audit log the refill submission
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      actorName: actor.name,
      targetPatientId: patientId,
      action: 'PRESCRIPTION_REFILL_REQUESTED',
      resourceName: 'prescription_refill',
      outcome: 'ALLOW',
      reasonCode: 'REFILL_REQUEST_PERSISTED',
      clientIp,
      requestId,
      metadata: {
        prescriptionId: prescription.id,
        medicationName: prescription.medicationName,
        pharmacyId: resolvedPharmacy.id,
        refillsRemaining: refillsRemainingAfter
      }
    });

    return {
      success: true,
      request: newRequest
    };
  },

  /**
   * List all refill requests for a specific patient.
   */
  getRefillRequestsForPatient(patientId: string): RefillRequest[] {
    return Array.from(refillStore.values())
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  },

  /**
   * Retrieve a specific refill request by ID.
   */
  getRequestById(requestId: string): RefillRequest | undefined {
    return refillStore.get(requestId);
  },

  /**
   * Clear all stored refill requests (for testing).
   */
  clearRefillRequests(): void {
    refillStore.clear();
    try {
      if (fs.existsSync(REFILL_STORAGE_FILE)) {
        fs.unlinkSync(REFILL_STORAGE_FILE);
      }
    } catch {}
  }
};
