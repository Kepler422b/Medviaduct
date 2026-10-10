import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { AuthenticationAdapter, AuthenticatedUser, SecurityDependencies } from '../security/contracts/interfaces.js';
import { PrismaIdentityRepository } from '../security/repositories/prismaIdentityRepository.js';
import { PrismaSecurityRepository } from '../security/repositories/prismaSecurityRepository.js';
import { createSecurityModule, SecurityModuleInstance } from '../security/router.js';
import { createAuthMiddleware } from '../security/auth/middleware.js';
import { correlationMiddleware } from '../security/middleware/correlation.js';
import { noStoreMiddleware } from '../security/middleware/noStore.js';
import { errorHandler } from '../security/middleware/errorHandler.js';
import { ClinicalSummarySecurityWrapper } from '../security/access/member4Wrapper.js';

/**
 * FailClosedAuthenticationAdapter
 * Default adapter used in production / standalone runtime until Member 2
 * supplies the canonical production authentication provider.
 *
 * CRITICAL SECURITY INVARIANT:
 * Always fails closed (returns null). Does not accept any demo headers or query parameters.
 */
export class FailClosedAuthenticationAdapter implements AuthenticationAdapter {
  async authenticate(_req: Request): Promise<AuthenticatedUser | null> {
    return null;
  }
}

export interface AppInstance {
  app: Express;
  prisma: PrismaClient;
  securityModule: SecurityModuleInstance;
}

export function createApp(customDeps?: Partial<SecurityDependencies>, prismaClient?: PrismaClient): AppInstance {
  const prisma = prismaClient ?? new PrismaClient();
  const identityRepo = customDeps?.identityRepo ?? new PrismaIdentityRepository(prisma);
  const securityRepo = customDeps?.securityRepo ?? new PrismaSecurityRepository(prisma);
  const authAdapter = customDeps?.authAdapter ?? new FailClosedAuthenticationAdapter();
  const clock = customDeps?.clock;

  const securityModule = createSecurityModule({
    authAdapter,
    identityRepo,
    securityRepo,
    clock,
  });

  const app = express();

  // Foundational HTTP hardening
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Grant-Id', 'X-Request-Id'],
    })
  );
  app.use(correlationMiddleware);
  app.use(noStoreMiddleware);

  // Health check endpoint (Public)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'medviaduct-security-host',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount Security Module under /api
  app.use('/api', securityModule.router);

  // Integration example route for Member 2: GET /api/patients/:id/timeline
  // Shows how Member 2 protects clinical endpoints using the centralized authorizer middleware
  const authMiddleware = createAuthMiddleware(authAdapter, identityRepo);
  const authorizeTimelineAccess = securityModule.authorizePatientAccessMiddleware(
    securityModule.authorizer,
    'timeline:read',
    {
      patientIdExtractor: (req) => String(req.params.id),
      resourceName: 'patient_timeline',
    }
  );


  app.get(
    '/api/patients/:id/timeline',
    authMiddleware,
    authorizeTimelineAccess,
    (req: Request, res: Response) => {
      // In production, Member 2 queries the actual clinical timeline database here
      res.status(200).json({
        patientId: req.params.id,
        timelineEvents: [
          {
            id: 'evt-1',
            date: '2026-09-01T10:00:00Z',
            category: 'Encounter',
            summary: 'Cardiology Consultation',
          },
          {
            id: 'evt-2',
            date: '2026-09-15T14:30:00Z',
            category: 'Prescription',
            summary: 'Lisinopril 10mg daily',
          },
        ],
        accessAudit: {
          authorizedRole: req.accessResult?.actorRole,
          grantId: req.accessResult?.grantId ?? null,
          accessMode: req.accessResult?.accessMode,
        },
      });
    }
  );

  // Protected route for individual encounters (Member 2)
  app.get(
    '/api/patients/:id/encounters/:encounterId',
    authMiddleware,
    securityModule.authorizePatientAccessMiddleware(securityModule.authorizer, 'timeline:read', {
      resourceName: 'encounter_detail',
    }),
    (req: Request, res: Response) => {
      res.status(200).json({
        patientId: req.params.id,
        encounterId: req.params.encounterId,
        details: 'Encounter consultation records',
        accessAudit: {
          authorizedRole: req.accessResult?.actorRole,
          grantId: req.accessResult?.grantId ?? null,
          accessMode: req.accessResult?.accessMode,
        },
      });
    }
  );

  // Protected route for medications/prescriptions (Member 2)
  app.get(
    '/api/patients/:id/medications',
    authMiddleware,
    securityModule.authorizePatientAccessMiddleware(securityModule.authorizer, 'timeline:read', {
      resourceName: 'patient_medications',
    }),
    (req: Request, res: Response) => {
      res.status(200).json({
        patientId: req.params.id,
        medications: ['Lisinopril 10mg', 'Metformin 500mg'],
        accessAudit: {
          authorizedRole: req.accessResult?.actorRole,
          grantId: req.accessResult?.grantId ?? null,
          accessMode: req.accessResult?.accessMode,
        },
      });
    }
  );

  // Protected route for download (Member 2)
  app.get(
    '/api/patients/:id/download',
    authMiddleware,
    securityModule.authorizePatientAccessMiddleware(securityModule.authorizer, 'timeline:read', {
      resourceName: 'patient_record_download',
    }),
    (req: Request, res: Response) => {
      res.status(200).json({
        patientId: req.params.id,
        downloadUrl: `https://storage.medviaduct.internal/records/${req.params.id}.pdf`,
        accessAudit: {
          authorizedRole: req.accessResult?.actorRole,
          grantId: req.accessResult?.grantId ?? null,
          accessMode: req.accessResult?.accessMode,
        },
      });
    }
  );

  // Protected route for export (Member 2)
  app.get(
    '/api/patients/:id/export',
    authMiddleware,
    securityModule.authorizePatientAccessMiddleware(securityModule.authorizer, 'timeline:read', {
      resourceName: 'patient_record_export',
    }),
    (req: Request, res: Response) => {
      res.status(200).json({
        patientId: req.params.id,
        exportFormat: 'fhir-json',
        recordsCount: 42,
        accessAudit: {
          authorizedRole: req.accessResult?.actorRole,
          grantId: req.accessResult?.grantId ?? null,
          accessMode: req.accessResult?.accessMode,
        },
      });
    }
  );

  // Protected route for record search (Member 2)
  app.get(
    '/api/patients/:id/records/search',
    authMiddleware,
    securityModule.authorizePatientAccessMiddleware(securityModule.authorizer, 'timeline:read', {
      resourceName: 'patient_record_search',
    }),
    (req: Request, res: Response) => {
      res.status(200).json({
        patientId: req.params.id,
        query: req.query.q ?? '',
        results: [],
        accessAudit: {
          authorizedRole: req.accessResult?.actorRole,
          grantId: req.accessResult?.grantId ?? null,
          accessMode: req.accessResult?.accessMode,
        },
      });
    }
  );

  // Protected route for AI Clinical Summary Generation (Member 4 Integration)
  const summaryWrapper = new ClinicalSummarySecurityWrapper(
    securityModule.authorizer,
    securityModule.auditService
  );

  app.post(
    '/api/patients/:id/clinical-summary',
    authMiddleware,
    async (req: Request, res: Response, next) => {
      try {
        const accessGrantId = req.headers['x-access-grant-id'] as string;
        const result = await summaryWrapper.executeProtectedSummaryGeneration(
          {
            actorUserId: req.authContext!.userId,
            patientId: String(req.params.id),
            accessGrantId,
            requestId: req.id!,
          },
          async (_pId) => {
            // Source records retrieved server-side
            return [
              { category: 'Cardiology', finding: 'Stable sinus rhythm' },
              { category: 'Endocrinology', finding: 'HbA1c controlled' },
            ];
          },
          async (records: any) => {
            // AI model invoked with server-retrieved records
            return {
              summaryText: `Patient summary generated from ${records.length} clinical observations. All vitals stable.`,
              generatedAt: new Date().toISOString(),
            };
          }
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // Unknown route handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found.',
        requestId: 'unknown',
      },
    });
  });

  // Central error handler
  app.use(errorHandler);

  return {
    app,
    prisma,
    securityModule,
  };
}
