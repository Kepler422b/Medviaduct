/**
 * MediVault / Medviaduct - Phase 6: Frontend Error Mapping & State Resolution (Member 1)
 * HackMatrix 5.0 - Track 02 (HLTH-01)
 */

import { SecurityApiError } from './apiHelpers.js';

export interface UserFriendlyError {
  httpStatus: number;
  errorCode: string;
  title: string;
  userMessage: string;
  actionGuidance: string;
  isRetryable: boolean;
  requiresReScan: boolean;
  requiresRelogin: boolean;
  wipeClinicalData: boolean;
}

export const ERROR_CODE_MAP: Record<string, Partial<UserFriendlyError>> = {
  // Authentication
  AUTH_REQUIRED: {
    title: 'Session Expired',
    userMessage: 'Your medical session has ended or is invalid.',
    actionGuidance: 'Please log in again to continue.',
    requiresRelogin: true,
    wipeClinicalData: true,
    isRetryable: false,
  },
  SESSION_EXPIRED: {
    title: 'Session Expired',
    userMessage: 'Your authentication credentials have expired.',
    actionGuidance: 'Please re-authenticate with your identity provider.',
    requiresRelogin: true,
    wipeClinicalData: true,
    isRetryable: false,
  },

  // Consent & Access Denials
  ACCESS_DENIED: {
    title: 'Access Unavailable',
    userMessage: 'Access is unavailable. The patient may have revoked consent or the grant has expired.',
    actionGuidance: 'Ask the patient to share a fresh QR invitation or grant consent again.',
    requiresReScan: true,
    wipeClinicalData: true,
    isRetryable: false,
  },
  QR_ACCESS_UNAVAILABLE: {
    title: 'QR Code Unavailable',
    userMessage: 'This QR invitation code has expired, already been resolved, or revoked.',
    actionGuidance: 'Please ask the patient to generate a new QR code on their screen.',
    requiresReScan: true,
    wipeClinicalData: false,
    isRetryable: false,
  },
  FORBIDDEN_ROLE: {
    title: 'Role Unauthorized',
    userMessage: 'Your current account role does not have permission to perform this medical action.',
    actionGuidance: 'Administrators and unverified clinicians cannot access individual patient records.',
    wipeClinicalData: true,
    isRetryable: false,
  },

  // Emergency Access Denials
  EMERGENCY_ACCESS_UNAUTHORIZED: {
    title: 'Emergency Permission Required',
    userMessage: 'Your clinician profile is not provisioned for emergency break-glass access.',
    actionGuidance: 'Contact hospital clinical administration to verify emergency credentials.',
    wipeClinicalData: true,
    isRetryable: false,
  },
  UNVERIFIED_CLINICIAN: {
    title: 'Verification Incomplete',
    userMessage: 'Your clinician medical license is unverified in this system.',
    actionGuidance: 'Only verified clinicians can resolve patient consents or declare emergency access.',
    wipeClinicalData: true,
    isRetryable: false,
  },

  // Rate Limiting & Validation
  RATE_LIMIT_EXCEEDED: {
    title: 'Rate Limit Reached',
    userMessage: 'Too many security requests received in a short period.',
    actionGuidance: 'Please pause and wait 60 seconds before trying again.',
    isRetryable: true,
    wipeClinicalData: false,
  },
  RATE_LIMITED: {
    title: 'Rate Limit Reached',
    userMessage: 'Too many security requests received in a short period.',
    actionGuidance: 'Please pause and wait 60 seconds before trying again.',
    isRetryable: true,
    wipeClinicalData: false,
  },
  INVALID_INPUT: {
    title: 'Invalid Request',
    userMessage: 'The input provided does not meet clinical security constraints.',
    actionGuidance: 'Check that clinical reason is at least 10 characters and duration is within bounds.',
    isRetryable: true,
    wipeClinicalData: false,
  },
  NOT_FOUND: {
    title: 'Record Not Found',
    userMessage: 'The requested consent, grant, or patient record was not found.',
    actionGuidance: 'Verify the identifier or start a new patient search.',
    isRetryable: false,
    wipeClinicalData: false,
  },
};

/**
 * Maps any raw HTTP or backend error response into a structured, user-friendly UI error.
 */
export function mapSecurityError(error: unknown): UserFriendlyError {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred.';

  if (typeof error === 'object' && error !== null) {
    const errObj = error as SecurityApiError;
    if (errObj.status) status = errObj.status;
    if (errObj.error?.code) code = errObj.error.code;
    if (errObj.error?.message) message = errObj.error.message;
  }

  const mapped = ERROR_CODE_MAP[code];

  return {
    httpStatus: status,
    errorCode: code,
    title: mapped?.title ?? (status === 403 ? 'Access Denied' : 'Request Error'),
    userMessage: mapped?.userMessage ?? message,
    actionGuidance: mapped?.actionGuidance ?? 'Please verify your request or consult the system administrator.',
    isRetryable: mapped?.isRetryable ?? (status >= 500),
    requiresReScan: mapped?.requiresReScan ?? (status === 403),
    requiresRelogin: mapped?.requiresRelogin ?? (status === 401),
    wipeClinicalData: mapped?.wipeClinicalData ?? (status === 401 || status === 403),
  };
}
