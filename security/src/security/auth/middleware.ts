import { Request, Response, NextFunction } from 'express';
import { AuthenticationAdapter, IdentityRepository } from '../contracts/interfaces.js';
import { UserRole } from '../contracts/types.js';
import { UnauthorizedError, ForbiddenError } from '../middleware/errorHandler.js';

export interface TrustedAuthContext {
  userId: string;
  role: UserRole;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authContext?: TrustedAuthContext;
    }
  }
}

/**
 * Creates authentication-required middleware backed by Member 2's adapter
 * and the trusted IdentityRepository.
 *
 * SECURITY INVARIANT:
 * Client-supplied headers, query parameters, or body fields claiming
 * role or verification status are NEVER trusted.
 * Roles and status are resolved purely from server records via IdentityRepository.
 */
export function createAuthMiddleware(
  authAdapter: AuthenticationAdapter,
  identityRepo: IdentityRepository
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authResult = await authAdapter.authenticate(req);
      if (!authResult || !authResult.userId) {
        throw new UnauthorizedError('Authentication required', 'UNAUTHENTICATED');
      }

      const account = await identityRepo.getUserAccount(authResult.userId);
      if (!account || !account.isActive) {
        throw new UnauthorizedError('Account is inactive or invalid', 'ACCOUNT_INACTIVE');
      }

      // Attach strictly trusted server-side context
      req.authContext = {
        userId: account.id,
        role: account.role,
        isActive: account.isActive,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware ensuring that the authenticated user possesses one of the allowed roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authContext) {
      return next(new UnauthorizedError('Authentication required', 'UNAUTHENTICATED'));
    }

    if (!allowedRoles.includes(req.authContext.role)) {
      return next(
        new ForbiddenError(
          'You do not have permission to access this resource.',
          'FORBIDDEN_ROLE'
        )
      );
    }

    next();
  };
}
