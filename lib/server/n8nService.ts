// lib/server/n8nService.ts
/**
 * Medviaduct n8n Webhook & Outbox Service
 *
 * Implements a durable outbox pattern for reliable, asynchronous event delivery
 * to n8n webhooks. Ensures patient record access and refill workflows never fail
 * due to external network or email issues.
 *
 * Security & Governance:
 * 1. Webhook URLs and secrets are read exclusively from server environment variables.
 * 2. Secrets are never logged or exposed in client bundles.
 * 3. Exact Header Auth configured in n8n credentials is provided.
 * 4. Idempotent event processing prevents duplicate emails.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export interface PatientProfileAccessedEventPayload {
  eventId: string;
  eventType: 'patient.profile.accessed';
  patientId: string;
  patientEmail: string;
  clinicianName: string;
  accessedAt: string;
  authorizationResult: 'allowed';
}

export interface PrescriptionRefillEventPayload {
  requestId: string;
  eventType: 'prescription.refill.requested';
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  prescriptionId: string;
  medicationName: string;
  dosage: string;
  requestedQuantity: number;
  refillsRemaining: number;
  pharmacyId: string;
  pharmacyName: string;
  pharmacyEmail: string;
  requestedAt: string;
  status: 'pending_pharmacy_review';
  disclaimer: string;
}

export type OutboxEventPayload =
  | PatientProfileAccessedEventPayload
  | PrescriptionRefillEventPayload;

export interface OutboxRecord {
  id: string; // eventId or requestId
  eventType: 'patient.profile.accessed' | 'prescription.refill.requested';
  payload: OutboxEventPayload;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'SKIPPED_UNCONFIGURED';
  attempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  deliveryResponseCode?: number;
  error?: string;
}

export function getEnvConfig(key: string, defaultValue = ''): string {
  if (process.env[key]) return process.env[key]!;
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const k = trimmed.slice(0, eqIdx).trim();
            if (k === key) {
              let v = trimmed.slice(eqIdx + 1).trim();
              if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                v = v.slice(1, -1);
              }
              return v;
            }
          }
        }
      }
    }
  } catch {}
  return defaultValue;
}

const OUTBOX_STORAGE_FILE = path.join(process.cwd(), '.medviaduct_outbox.json');
const MAX_DELIVERY_ATTEMPTS = 3;
const DELIVERY_TIMEOUT_MS = 5000;

// In-memory outbox cache
const outboxStore = new Map<string, OutboxRecord>();

// Helper to persist outbox to disk safely
function saveOutboxToDisk() {
  try {
    const list = Array.from(outboxStore.values());
    fs.writeFileSync(OUTBOX_STORAGE_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {
    // Non-critical in serverless/readonly environments
  }
}

// Helper to load outbox from disk on startup
function loadOutboxFromDisk() {
  try {
    if (fs.existsSync(OUTBOX_STORAGE_FILE)) {
      const data = fs.readFileSync(OUTBOX_STORAGE_FILE, 'utf-8');
      const list: OutboxRecord[] = JSON.parse(data);
      for (const item of list) {
        outboxStore.set(item.id, item);
      }
    }
  } catch {
    // Ignore corrupt or unreadable cache file
  }
}

// Initial load
loadOutboxFromDisk();

export const n8nService = {
  /**
   * Persist a patient profile accessed event in the durable outbox and trigger dispatch.
   */
  async enqueuePatientAccessEvent(params: {
    patientId: string;
    patientEmail: string;
    clinicianName: string;
    accessedAt?: string;
  }): Promise<OutboxRecord> {
    const eventId = `evt_${randomUUID()}`;
    const accessedAt = params.accessedAt || new Date().toISOString();

    const payload: PatientProfileAccessedEventPayload = {
      eventId,
      eventType: 'patient.profile.accessed',
      patientId: params.patientId,
      patientEmail: params.patientEmail,
      clinicianName: params.clinicianName,
      accessedAt,
      authorizationResult: 'allowed'
    };

    const record: OutboxRecord = {
      id: eventId,
      eventType: 'patient.profile.accessed',
      payload,
      status: 'PENDING',
      attempts: 0,
      createdAt: accessedAt
    };

    outboxStore.set(eventId, record);
    saveOutboxToDisk();

    // Trigger delivery without blocking or throwing to clinical caller
    await this.dispatchRecord(eventId).catch((err) => {
      console.error(`[n8n Outbox] Delivery error for event ${eventId}:`, err?.message || err);
    });

    return record;
  },

  /**
   * Persist a prescription refill event in the durable outbox and trigger dispatch.
   */
  async enqueueRefillEvent(payload: PrescriptionRefillEventPayload): Promise<OutboxRecord> {
    const recordId = payload.requestId;

    const record: OutboxRecord = {
      id: recordId,
      eventType: 'prescription.refill.requested',
      payload,
      status: 'PENDING',
      attempts: 0,
      createdAt: payload.requestedAt
    };

    outboxStore.set(recordId, record);
    saveOutboxToDisk();

    // Trigger delivery without throwing
    await this.dispatchRecord(recordId).catch((err) => {
      console.error(`[n8n Outbox] Delivery error for refill ${recordId}:`, err?.message || err);
    });

    return record;
  },

  /**
   * Attempt delivery of an outbox record to the configured n8n webhook.
   */
  async dispatchRecord(recordId: string): Promise<OutboxRecord> {
    const record = outboxStore.get(recordId);
    if (!record) {
      throw new Error(`Outbox record ${recordId} not found`);
    }

    // Idempotency: if already delivered, do not re-send
    if (record.status === 'DELIVERED') {
      return record;
    }

    // Prevent exceeding maximum attempts
    if (record.attempts >= MAX_DELIVERY_ATTEMPTS) {
      return record;
    }

    record.attempts += 1;
    record.lastAttemptAt = new Date().toISOString();

    // Resolve target webhook URL and secrets from environment variables or .env file
    const webhookUrl =
      record.eventType === 'patient.profile.accessed'
        ? getEnvConfig('N8N_PATIENT_ACCESS_WEBHOOK_URL')
        : getEnvConfig('N8N_REFILL_WEBHOOK_URL');

    const secret = getEnvConfig('N8N_WEBHOOK_SECRET');
    const customHeaderName = getEnvConfig('N8N_HEADER_AUTH_NAME', 'X-Medviaduct-Secret');

    // If webhook URL is unconfigured, record as safely queued/skipped
    if (!webhookUrl || !webhookUrl.trim()) {
      record.status = 'SKIPPED_UNCONFIGURED';
      record.error = `Webhook URL for ${record.eventType} is not configured in environment variables.`;
      saveOutboxToDisk();
      return record;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Medviaduct-Event-Id': record.id
      };

      if (secret) {
        // Provide the exact header configured in n8n Header Auth credential
        headers[customHeaderName] = secret;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      const res = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers,
        body: JSON.stringify(record.payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      record.deliveryResponseCode = res.status;

      if (res.ok) {
        record.status = 'DELIVERED';
        record.error = undefined;
      } else {
        record.status = 'FAILED';
        record.error = `n8n webhook returned HTTP ${res.status} ${res.statusText}`;
      }
    } catch (err: any) {
      record.status = 'FAILED';
      record.error = err.name === 'AbortError' ? 'Webhook delivery timed out after 5s' : err.message || 'Network error';
    }

    saveOutboxToDisk();
    return record;
  },

  /**
   * Safe retry of all failed records in the outbox.
   */
  async retryFailedRecords(): Promise<{ retried: number; delivered: number; failed: number }> {
    let retried = 0;
    let delivered = 0;
    let failed = 0;

    for (const [id, record] of outboxStore.entries()) {
      if (record.status === 'FAILED' && record.attempts < MAX_DELIVERY_ATTEMPTS) {
        retried++;
        const updated = await this.dispatchRecord(id);
        if (updated.status === 'DELIVERED') delivered++;
        else failed++;
      }
    }

    return { retried, delivered, failed };
  },

  /**
   * Retrieve all outbox records for inspection/auditing.
   */
  getOutboxRecords(): OutboxRecord[] {
    loadOutboxFromDisk();
    return Array.from(outboxStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  /**
   * Retrieve a specific outbox record by ID.
   */
  getRecordById(id: string): OutboxRecord | undefined {
    return outboxStore.get(id);
  },

  /**
   * Clear outbox records (primarily for testing fixtures).
   */
  clearOutbox(): void {
    outboxStore.clear();
    try {
      if (fs.existsSync(OUTBOX_STORAGE_FILE)) {
        fs.unlinkSync(OUTBOX_STORAGE_FILE);
      }
    } catch {}
  }
};
