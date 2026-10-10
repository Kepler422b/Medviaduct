import { Router, Request, Response, NextFunction } from 'express';
import { ConsentService } from './service.js';
import { CreateConsentSchema, RevokeConsentParamsSchema } from '../contracts/schemas.js';
import { requireRole } from '../auth/middleware.js';

export function createConsentRouter(consentService: ConsentService): Router {
  const router = Router();

  // All consent lifecycle endpoints require PATIENT role
  router.use(requireRole('PATIENT'));

  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const validatedInput = CreateConsentSchema.parse(req.body);
        const consent = await consentService.createConsent({
          userId: req.authContext!.userId,
          input: validatedInput,
          requestId: req.id!,
        });
        res.status(201).json(consent);
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const consents = await consentService.listConsents({
          userId: req.authContext!.userId,
          requestId: req.id!,
        });
        res.status(200).json(consents);
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/:id/revoke',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { id } = RevokeConsentParamsSchema.parse(req.params);
        const consent = await consentService.revokeConsent({
          userId: req.authContext!.userId,
          consentId: id,
          requestId: req.id!,
        });
        res.status(200).json(consent);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
