import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { EmergencyAccessService } from './service.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { AuthenticationAdapter, IdentityRepository } from '../contracts/interfaces.js';
import { noStoreMiddleware } from '../middleware/noStore.js';

export function createEmergencyRouter(
  emergencyService: EmergencyAccessService,
  authAdapter: AuthenticationAdapter,
  identityRepo: IdentityRepository,
  options?: {
    rateLimitMax?: number;
    rateLimitWindowMs?: number;
  }
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authAdapter, identityRepo);

  // Enforce no-store cache headers and authentication on all emergency endpoints
  router.use(noStoreMiddleware);
  router.use(authMiddleware);

  const emergencyLimiter = rateLimit({
    windowMs: options?.rateLimitWindowMs ?? 60 * 1000,
    max: options?.rateLimitMax ?? 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many emergency access requests. Please try again later.',
        requestId: 'unknown',
      },
    },
  });

  /**
   * POST /api/emergency-access
   * Declares emergency record access with explicit medical justification.
   * Clinician-only. Server-calculated 5-minute expiry.
   */
  router.post(
    '/',
    emergencyLimiter,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await emergencyService.declareEmergencyAccess({
          userId: req.authContext!.userId,
          input: req.body,
          requestId: req.id || 'unknown',
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /api/emergency-access
   * - Patients see safe metadata for emergency access to their own records.
   * - Clinicians see their own grant metadata.
   * - Administrators are denied.
   */
  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const grants = await emergencyService.listEmergencyGrants(
          req.authContext!.userId,
          req.id!
        );
        res.status(200).json(grants);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /api/emergency-access/:id
   * Inspects emergency grant status and scopes.
   */
  router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const grant = await emergencyService.getEmergencyGrant(
          req.authContext!.userId,
          String(req.params.id)
        );
        if (!grant) {
          res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'Emergency access grant not found.',
              requestId: req.id,
            },
          });
          return;
        }
        res.status(200).json(grant);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /api/emergency-access/:id/revoke
   * Revokes an emergency grant early (clinician or patient subject).
   */
  router.post(
    '/:id/revoke',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await emergencyService.revokeEmergencyAccess(
          req.authContext!.userId,
          String(req.params.id),
          req.id || 'unknown'
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
