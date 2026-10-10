import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { QrService } from './service.js';
import { GenerateQrSchema, ResolveQrSchema } from '../contracts/schemas.js';
import { requireRole } from '../auth/middleware.js';
import { noStoreMiddleware } from '../middleware/noStore.js';

export function createQrRouter(
  qrService: QrService,
  options?: {
    rateLimitMax?: number;
    rateLimitWindowMs?: number;
  }
): Router {
  const router = Router();

  // Enforce no-store on all QR responses
  router.use(noStoreMiddleware);

  const qrLimiter = rateLimit({
    windowMs: options?.rateLimitWindowMs ?? 60 * 1000,
    max: options?.rateLimitMax ?? 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        requestId: 'unknown',
      },
    },
  });

  router.post(
    '/generate',
    qrLimiter,
    requireRole('PATIENT'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const validatedInput = GenerateQrSchema.parse(req.body);
        const result = await qrService.generateQr({
          userId: req.authContext!.userId,
          input: validatedInput,
          requestId: req.id!,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/resolve',
    qrLimiter,
    requireRole('CLINICIAN'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const validatedInput = ResolveQrSchema.parse(req.body);
        const result = await qrService.resolveQr({
          userId: req.authContext!.userId,
          input: validatedInput,
          requestId: req.id!,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
