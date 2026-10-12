import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export class SecurityError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'SecurityError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class UnauthorizedError extends SecurityError {
  constructor(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    super(401, code, message);
  }
}

export class ForbiddenError extends SecurityError {
  constructor(message = 'You do not have permission to access this resource.', code = 'ACCESS_DENIED') {
    super(403, code, message);
  }
}

export class NotFoundError extends SecurityError {
  constructor(message = 'The requested resource was not found.', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends SecurityError {
  constructor(message = 'Resource state conflict.', code = 'CONFLICT') {
    super(409, code, message);
  }
}

export class ValidationError extends SecurityError {
  constructor(message = 'Invalid request payload.', code = 'VALIDATION_ERROR') {
    super(400, code, message);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id || (typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : uuidv4());

  if (err instanceof SecurityError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.errors.map((e) => e.message).join('; '),
        requestId,
      },
    });
    return;
  }

  // Fallback for unhandled server errors (never leak stack traces or internal details)
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred.',
      requestId,
    },
  });
}
