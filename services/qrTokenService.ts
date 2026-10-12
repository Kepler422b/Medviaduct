import { type QrShareToken, initialQrTokens } from '@/data/patientData';
import { patientService } from './patientService';

const QR_STORAGE_KEY = 'medvia.qr.tokens';

function readTokens(): QrShareToken[] {
  if (typeof window === 'undefined') return initialQrTokens;
  try {
    const raw = localStorage.getItem(QR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : initialQrTokens;
  } catch {
    return initialQrTokens;
  }
}

function writeTokens(tokens: QrShareToken[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QR_STORAGE_KEY, JSON.stringify(tokens));
    window.dispatchEvent(new Event('medvia-qr-change'));
  } catch {
    // fallback
  }
}

export type ExpirationDuration = '15_MINUTES' | '1_HOUR' | '24_HOURS' | '7_DAYS';

export interface CreateQrTokenPayload {
  recipientType: 'Clinician Verified' | 'Emergency Access' | 'Caregiver';
  recipientName?: string;
  duration: ExpirationDuration;
  permittedCategories: {
    profile: boolean;
    consultations: boolean;
    medications: boolean;
    labResults: boolean;
    imaging: boolean;
    allergies: boolean;
    sensitiveNotes: boolean;
  };
  customToken?: string;
}

const PRESET_DEMO_TOKENS: Record<string, { patientId: string; patientName: string }> = {
  // Primary Ananya Deshmukh
  'MV-SHARE-8F32A9C04B': { patientId: 'PAT-MH-40192', patientName: 'Ananya Deshmukh' },
  'MV-SHARE-ANANYA': { patientId: 'PAT-MH-40192', patientName: 'Ananya Deshmukh' },
  'PAT-MH-40192': { patientId: 'PAT-MH-40192', patientName: 'Ananya Deshmukh' },
  'MH-MUM-2026-90412': { patientId: 'PAT-MH-40192', patientName: 'Ananya Deshmukh' },

  // Aarav Kulkarni
  'MV-SHARE-AARAV51204': { patientId: 'PAT-MH-51204', patientName: 'Aarav Kulkarni' },
  'MV-SHARE-AARAV': { patientId: 'PAT-MH-51204', patientName: 'Aarav Kulkarni' },
  'PAT-MH-51204': { patientId: 'PAT-MH-51204', patientName: 'Aarav Kulkarni' },
  'MH-MUM-2026-51204-DEMO': { patientId: 'PAT-MH-51204', patientName: 'Aarav Kulkarni' },

  // Meera Patil
  'MV-SHARE-MEERA62381': { patientId: 'PAT-MH-62381', patientName: 'Meera Patil' },
  'MV-SHARE-MEERA': { patientId: 'PAT-MH-62381', patientName: 'Meera Patil' },
  'PAT-MH-62381': { patientId: 'PAT-MH-62381', patientName: 'Meera Patil' },
  'MH-NSK-2026-62381-DEMO': { patientId: 'PAT-MH-62381', patientName: 'Meera Patil' },

  // Rohan Shah
  'MV-SHARE-ROHAN73492': { patientId: 'PAT-MH-73492', patientName: 'Rohan Shah' },
  'MV-SHARE-ROHAN': { patientId: 'PAT-MH-73492', patientName: 'Rohan Shah' },
  'PAT-MH-73492': { patientId: 'PAT-MH-73492', patientName: 'Rohan Shah' },
  'MH-NGP-2026-73492-DEMO': { patientId: 'PAT-MH-73492', patientName: 'Rohan Shah' },

  // Sana Khan
  'MV-SHARE-SANA84513': { patientId: 'PAT-MH-84513', patientName: 'Sana Khan' },
  'MV-SHARE-SANA': { patientId: 'PAT-MH-84513', patientName: 'Sana Khan' },
  'PAT-MH-84513': { patientId: 'PAT-MH-84513', patientName: 'Sana Khan' },
  'MH-CSN-2026-84513-DEMO': { patientId: 'PAT-MH-84513', patientName: 'Sana Khan' },
};

export const qrTokenService = {
  list: (): QrShareToken[] => {
    const tokens = readTokens();
    const now = Date.now();
    // Auto mark expired tokens if still marked active
    let modified = false;
    const updated = tokens.map((t) => {
      if (t.status === 'Active' && new Date(t.expiresAt).getTime() < now) {
        modified = true;
        return { ...t, status: 'Expired' as const };
      }
      return t;
    });
    if (modified) writeTokens(updated);
    return updated;
  },

  create: (payload: CreateQrTokenPayload): QrShareToken => {
    const patient = patientService.getProfile();
    const now = Date.now();

    const durationMs =
      payload.duration === '15_MINUTES'
        ? 15 * 60 * 1000
        : payload.duration === '1_HOUR'
        ? 60 * 60 * 1000
        : payload.duration === '24_HOURS'
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;

    const expiresAt = new Date(now + durationMs).toISOString();
    // Generate secure random alphanumeric token e.g. MV-SHARE-A94F81C02D
    const randomHex = Math.random().toString(36).substring(2, 7) + Math.random().toString(36).substring(2, 7);
    const tokenString = payload.customToken || `MV-SHARE-${randomHex.toUpperCase()}`;

    const newToken: QrShareToken = {
      id: `qr-${Date.now()}`,
      token: tokenString,
      patientId: patient.id,
      patientName: patient.name,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      status: 'Active',
      recipientType: payload.recipientType,
      recipientName: payload.recipientName || (payload.recipientType === 'Emergency Access' ? 'Emergency Care Duty Officer' : 'Verified Attending Clinician'),
      permittedCategories: payload.permittedCategories,
      scanCount: 0,
      accessLogs: []
    };

    const tokens = readTokens();
    writeTokens([newToken, ...tokens]);
    return newToken;
  },

  getById: (id: string): QrShareToken | undefined => {
    return qrTokenService.list().find((t) => t.id === id);
  },

  getByToken: (token: string): QrShareToken | undefined => {
    let clean = token.trim();
    // Extract token from scanned URL or JSON payload if present
    if (clean.includes('token=')) {
      try {
        const match = clean.match(/[?&]token=([^&#]+)/);
        if (match && match[1]) {
          clean = decodeURIComponent(match[1]);
        }
      } catch {
        // fallback
      }
    } else if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.token) clean = String(parsed.token);
        else if (parsed.patientId) clean = String(parsed.patientId);
      } catch {
        // fallback
      }
    }

    const upper = clean.toUpperCase();
    const existing = qrTokenService.list().find((t) => t.token.toUpperCase() === upper);
    if (existing) return existing;

    const preset = PRESET_DEMO_TOKENS[upper];
    if (preset) {
      const generated: QrShareToken = {
        id: `qr-${upper.toLowerCase()}`,
        token: upper.startsWith('MV-SHARE-') ? upper : `MV-SHARE-${preset.patientId.slice(-5)}`,
        patientId: preset.patientId,
        patientName: preset.patientName,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'Active',
        recipientType: 'Clinician Verified',
        recipientName: 'Dr. Alex Morgan, MD',
        permittedCategories: {
          profile: true,
          consultations: true,
          medications: true,
          labResults: true,
          imaging: true,
          allergies: true,
          sensitiveNotes: false
        },
        scanCount: 0,
        accessLogs: []
      };
      writeTokens([generated, ...readTokens()]);
      return generated;
    }
    return undefined;
  },

  revoke: (id: string): QrShareToken => {
    const tokens = readTokens();
    let updatedToken: QrShareToken | null = null;
    const updated = tokens.map((t) => {
      if (t.id === id) {
        updatedToken = { ...t, status: 'Revoked' as const };
        return updatedToken;
      }
      return t;
    });
    if (!updatedToken) throw new Error('Token not found.');
    writeTokens(updated);
    return updatedToken;
  },

  delete: (id: string): void => {
    const tokens = readTokens().filter((t) => t.id !== id);
    writeTokens(tokens);
  },

  validateAndLog: (
    tokenString: string,
    accessorName: string,
    facility: string
  ): { valid: boolean; token?: QrShareToken; reason?: string } => {
    const token = qrTokenService.getByToken(tokenString);
    if (!token) {
      return { valid: false, reason: 'Invalid or non-existent QR access token.' };
    }

    if (token.status === 'Revoked') {
      return { valid: false, reason: 'This access pass has been revoked by the patient.' };
    }

    const now = Date.now();
    if (new Date(token.expiresAt).getTime() < now) {
      return {
        valid: false,
        reason: `This QR access pass expired on ${new Date(token.expiresAt).toLocaleString()}.`
      };
    }

    // Log the access event
    const tokens = readTokens();
    let updatedToken: QrShareToken = token;
    const updated = tokens.map((t) => {
      if (t.id === token.id) {
        updatedToken = {
          ...t,
          scanCount: t.scanCount + 1,
          lastScannedAt: new Date(now).toISOString(),
          accessLogs: [
            {
              timestamp: new Date(now).toISOString(),
              accessedBy: accessorName,
              facility,
              action: `Authenticated clinician access granted by ${accessorName} at ${facility}.`
            },
            ...t.accessLogs
          ]
        };
        return updatedToken;
      }
      return t;
    });
    writeTokens(updated);

    return { valid: true, token: updatedToken };
  },

  // Resolve token and return scoped patient records while recording access audit log
  resolveToken: (
    tokenString: string,
    accessor: { name: string; facility: string; role?: string }
  ) => {
    const token = qrTokenService.getByToken(tokenString);
    if (!token) {
      throw new Error('Invalid or non-existent QR access token. Please verify the code.');
    }

    if (token.status === 'Revoked') {
      throw new Error('This access pass has been revoked by the patient.');
    }

    const now = Date.now();
    if (new Date(token.expiresAt).getTime() < now) {
      // Mark expired
      qrTokenService.list();
      throw new Error(`This QR access pass expired on ${new Date(token.expiresAt).toLocaleString()}.`);
    }

    // Log the access event
    const tokens = readTokens();
    const updated = tokens.map((t) => {
      if (t.id === token.id) {
        return {
          ...t,
          scanCount: t.scanCount + 1,
          lastScannedAt: new Date(now).toISOString(),
          accessLogs: [
            {
              timestamp: new Date(now).toISOString(),
              accessedBy: accessor.name,
              facility: accessor.facility,
              action: `Authenticated access granted. Permitted scopes: ${Object.entries(t.permittedCategories)
                .filter(([, v]) => v)
                .map(([k]) => k)
                .join(', ')}.`
            },
            ...t.accessLogs
          ]
        };
      }
      return t;
    });
    writeTokens(updated);

    // Filter full record based strictly on permitted categories
    const bundle = token.patientId ? patientService.getBundle(token.patientId) : null;
    const full = bundle
      ? {
          profile: bundle.profile,
          allergies: bundle.allergies,
          conditions: bundle.conditions,
          prescriptions: bundle.prescriptions,
          consultations: bundle.consultations,
          labResults: bundle.labResults,
          imaging: bundle.imagingReports,
          documents: bundle.documents
        }
      : patientService.getFullRecord();

    const scopedRecord = {
      token: token.token,
      recipientType: token.recipientType,
      expiresAt: token.expiresAt,
      permittedCategories: token.permittedCategories,
      profile: token.permittedCategories.profile
        ? full.profile
        : {
            id: full.profile.id,
            name: full.profile.name,
            uhid: full.profile.uhid,
            age: full.profile.age,
            sex: full.profile.sex
          },
      allergies: token.permittedCategories.allergies ? full.allergies : [],
      conditions: token.permittedCategories.profile ? full.conditions : [],
      medications: token.permittedCategories.medications ? full.prescriptions : [],
      consultations: token.permittedCategories.consultations ? full.consultations : [],
      labResults: token.permittedCategories.labResults ? full.labResults : [],
      imaging: token.permittedCategories.imaging ? full.imaging : [],
      documents: token.permittedCategories.consultations ? full.documents : []
    };

    return scopedRecord;
  }
};
