/**
 * Sensitive field redaction utility.
 * Prevents tokens, passwords, authorization headers, and raw credentials
 * from appearing in console, telemetry, or server logs.
 */

const SENSITIVE_KEYS = new Set([
  'token',
  'tokenhash',
  'authorization',
  'cookie',
  'password',
  'secret',
  'key',
]);

export function redactSensitive<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    // Redact Bearer tokens if found in raw strings
    return input.replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]') as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitive(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = redactSensitive(value);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  return input;
}

export function safeLog(message: string, data?: unknown): void {
  if (data !== undefined) {
    // eslint-disable-next-line no-console
    console.log(message, JSON.stringify(redactSensitive(data)));
  } else {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}
