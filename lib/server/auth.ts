import { createHash } from 'crypto';

export type UserRole = 'PATIENT' | 'CLINICIAN' | 'ADMIN';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  domainId?: string; // patientId or clinicianId
  licenseNumber?: string;
  isAssignedToPatientA?: boolean;
  isVerified?: boolean;
  hasEmergencyPermission?: boolean;
}

// Canonical seeded test accounts required for demonstration
export const SEEDED_ACCOUNTS: Record<string, AuthUser> = {
  // 1. Patient A (Primary)
  'patient-a': {
    userId: 'usr-pat-ananya-40192',
    email: 'ananya.deshmukh@medviaduct.org',
    name: 'Ananya Deshmukh',
    role: 'PATIENT',
    domainId: 'PAT-MH-40192',
    isVerified: true
  },
  // 2. Patient B (Secondary - for IDOR tests)
  'patient-b': {
    userId: 'usr-pat-aarav-51204',
    email: 'aarav.kulkarni@medviaduct.org',
    name: 'Aarav Kulkarni',
    role: 'PATIENT',
    domainId: 'PAT-MH-51204',
    isVerified: true
  },
  // 3. Assigned Clinician (Dr. Alex Morgan - assigned primary care physician to Patient A)
  'clinician-assigned': {
    userId: 'usr-doc-morgan-84920',
    email: 'dr.alex.morgan@hospital.org',
    name: 'Dr. Alex Morgan, MD',
    role: 'CLINICIAN',
    domainId: 'DOC-MMC-84920',
    licenseNumber: 'MH-MED-84920',
    isAssignedToPatientA: true,
    isVerified: true,
    hasEmergencyPermission: true
  },
  // 4. Unassigned Clinician (Dr. Priya Sharma - unassigned to Patient A, works at Apollo)
  'clinician-unassigned': {
    userId: 'usr-doc-sharma-91023',
    email: 'dr.priya.sharma@hospital.org',
    name: 'Dr. Priya Sharma, MD',
    role: 'CLINICIAN',
    domainId: 'DOC-MMC-91023',
    licenseNumber: 'MH-MED-91023',
    isAssignedToPatientA: false,
    isVerified: true,
    hasEmergencyPermission: false
  },
  // 5. Regional Surveillance Administrator (Restricted to aggregate epidemiology only)
  'administrator': {
    userId: 'usr-adm-maharashtra-001',
    email: 'director.surveillance@medviaduct.gov.in',
    name: 'Dr. S. K. Joshi (Director, Public Health)',
    role: 'ADMIN',
    domainId: 'ADM-MH-001',
    isVerified: true
  }
};

// Current active session state (in-memory, defaults to assigned clinician)
let currentSessionKey: string = 'clinician-assigned';

export function getActiveSessionKey(): string {
  return currentSessionKey;
}

export function setActiveSessionKey(key: string): AuthUser {
  if (!SEEDED_ACCOUNTS[key]) {
    throw new Error(`Unknown demo account: ${key}. Available: ${Object.keys(SEEDED_ACCOUNTS).join(', ')}`);
  }
  currentSessionKey = key;
  return SEEDED_ACCOUNTS[key];
}

/**
 * Extracts and verifies the authenticated user from the request.
 * Prioritizes:
 * 1. Explicit Bearer token mapping
 * 2. Header `X-Demo-Account` override (for automated test isolation)
 * 3. Default active in-memory session
 */
export async function authenticateRequest(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get('authorization') || '';
  const demoAccountHeader = req.headers.get('x-demo-account') || '';

  // 1. Check explicit header override (used by test suites and demo switcher)
  if (demoAccountHeader && SEEDED_ACCOUNTS[demoAccountHeader]) {
    return SEEDED_ACCOUNTS[demoAccountHeader];
  }

  // 2. Check Bearer token mappings
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === 'patient-a-token' || token.includes('ananya')) return SEEDED_ACCOUNTS['patient-a'];
    if (token === 'patient-b-token' || token.includes('aarav')) return SEEDED_ACCOUNTS['patient-b'];
    if (token === 'clinician-assigned-token' || token === 'dr-morgan-token') return SEEDED_ACCOUNTS['clinician-assigned'];
    if (token === 'clinician-unassigned-token' || token === 'dr-sharma-token') return SEEDED_ACCOUNTS['clinician-unassigned'];
    if (token === 'admin-token') return SEEDED_ACCOUNTS['administrator'];
  }

  // 3. Fallback to current verified active session
  return SEEDED_ACCOUNTS[currentSessionKey] || null;
}

export function getActorFromRequest(req: Request): AuthUser {
  const authHeader = req.headers.get('authorization') || '';
  const demoAccountHeader =
    req.headers.get('x-demo-account') ||
    req.headers.get('x-actor-id') ||
    '';

  if (demoAccountHeader && SEEDED_ACCOUNTS[demoAccountHeader]) {
    return SEEDED_ACCOUNTS[demoAccountHeader];
  }

  // Check cookie if available
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/medviaduct_actor=([^;]+)/);
  if (match && match[1] && SEEDED_ACCOUNTS[match[1]]) {
    return SEEDED_ACCOUNTS[match[1]];
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === 'patient-a-token' || token.includes('ananya')) return SEEDED_ACCOUNTS['patient-a'];
    if (token === 'patient-b-token' || token.includes('aarav')) return SEEDED_ACCOUNTS['patient-b'];
    if (token === 'clinician-assigned-token' || token === 'dr-morgan-token') return SEEDED_ACCOUNTS['clinician-assigned'];
    if (token === 'clinician-unassigned-token' || token === 'dr-sharma-token') return SEEDED_ACCOUNTS['clinician-unassigned'];
    if (token === 'admin-token') return SEEDED_ACCOUNTS['administrator'];
  }

  return SEEDED_ACCOUNTS[currentSessionKey] || SEEDED_ACCOUNTS['clinician-assigned'];
}

export function switchActor(key: string): AuthUser {
  return setActiveSessionKey(key);
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
