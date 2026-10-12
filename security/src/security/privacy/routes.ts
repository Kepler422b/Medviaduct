import { Router, Request, Response, NextFunction } from 'express';
import { PrivacyBoundaryService, RawAggregateBucket } from './boundary.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { AuthenticationAdapter, IdentityRepository } from '../contracts/interfaces.js';
import { AggregateQueryFilterSchema } from '../contracts/schemas.js';

export function createAnalyticsRouter(
  privacyService: PrivacyBoundaryService,
  authAdapter: AuthenticationAdapter,
  identityRepo: IdentityRepository,
  fetchRawAggregatesProvider?: (filters: Record<string, string | undefined>) => Promise<RawAggregateBucket[]>
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authAdapter, identityRepo);

  router.use(authMiddleware);

  /**
   * GET /analytics/aggregates
   * Retrieves privacy-protected aggregate counts for disease monitoring.
   * Accessible by public health administrators and authorized clinicians.
   * All small cells (< 10) are suppressed as unavailable (`null`), NEVER zero!
   */
  router.get(
    '/aggregates',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userAccount = await identityRepo.getUserAccount(req.authContext!.userId);
        if (!userAccount || !userAccount.isActive) {
          res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'Access denied: User account is inactive.',
              requestId: req.id,
            },
          });
          return;
        }

        // Validate query params
        const filterParse = AggregateQueryFilterSchema.safeParse(req.query);
        const filters = filterParse.success ? filterParse.data : {};

        // Fetch raw aggregates from provider or return synthetic benchmark data
        let rawBuckets: RawAggregateBucket[] = [];
        if (fetchRawAggregatesProvider) {
          rawBuckets = await fetchRawAggregatesProvider(filters);
        } else {
          // Standard synthetic disease trend benchmark dataset
          rawBuckets = [
            { region: 'District-North', timeBucket: '2026-W38', conditionCategory: 'Respiratory', count: 42 },
            { region: 'District-North', timeBucket: '2026-W39', conditionCategory: 'Respiratory', count: 45 },
            { region: 'District-North', timeBucket: '2026-W40', conditionCategory: 'Respiratory', count: 118 }, // Outbreak!
            { region: 'District-North', timeBucket: '2026-W40', conditionCategory: 'Waterborne', count: 4 },   // Suppressed (< 10)
            { region: 'District-South', timeBucket: '2026-W40', conditionCategory: 'Vectorborne', count: 7 },  // Suppressed (< 10)
            { region: 'District-South', timeBucket: '2026-W40', conditionCategory: 'Respiratory', count: 28 },
          ];
        }

        // Apply privacy boundary and group-size suppression
        const permittedAggregates = await privacyService.sanitizeAndProtectAggregateFeed(
          rawBuckets,
          {
            actorUserId: req.authContext!.userId,
            actorRole: userAccount.role,
            requestId: req.id || 'unknown',
            modelConsumer: userAccount.role === 'ADMIN' ? 'PUBLIC_HEALTH_ADMIN' : 'CLINICAL_AGGREGATE_VIEW',
          }
        );

        res.status(200).json({
          thresholdApplied: privacyService.minimumThreshold,
          aggregates: permittedAggregates,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /analytics/model-input
   * Phase 5: Exposes the approved model-input contract for Member 4's anomaly model.
   * Strictly validates distinct patient counting, complementary suppression,
   * fixed calendar periods, and null for suppressed counts (NEVER 0).
   */
  router.get(
    '/model-input',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userAccount = await identityRepo.getUserAccount(req.authContext!.userId);
        if (!userAccount || !userAccount.isActive) {
          res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'Access denied: User account is inactive.',
              requestId: req.id,
            },
          });
          return;
        }

        // Benchmark groups with distinct contributing patient tracking
        const benchmarkRawGroups = [
          {
            region: 'District-North',
            timeBucket: '2026-W38',
            conditionCategory: 'Respiratory',
            distinctPatientIds: Array.from({ length: 42 }, (_, i) => `pat-n-38-${i}`),
            caseCount: 42,
          },
          {
            region: 'District-North',
            timeBucket: '2026-W39',
            conditionCategory: 'Respiratory',
            distinctPatientIds: Array.from({ length: 45 }, (_, i) => `pat-n-39-${i}`),
            caseCount: 45,
          },
          {
            region: 'District-North',
            timeBucket: '2026-W40',
            conditionCategory: 'Respiratory',
            distinctPatientIds: Array.from({ length: 110 }, (_, i) => `pat-n-40-${i}`),
            caseCount: 118, // Outbreak! Multiple visits included
          },
          {
            region: 'District-North',
            timeBucket: '2026-W40',
            conditionCategory: 'Waterborne',
            distinctPatientIds: ['pat-w-1', 'pat-w-2', 'pat-w-3'], // Only 3 distinct patients (< 10)
            caseCount: 15, // 15 visits, but only 3 distinct patients -> MUST BE SUPPRESSED!
          },
          {
            region: 'District-South',
            timeBucket: '2026-W40',
            conditionCategory: 'Vectorborne',
            distinctPatientIds: ['pat-v-1', 'pat-v-2', 'pat-v-3', 'pat-v-4', 'pat-v-5', 'pat-v-6', 'pat-v-7'], // 7 patients (< 10)
            caseCount: 7, // Suppressed (< 10)
          },
          {
            region: 'District-South',
            timeBucket: '2026-W40',
            conditionCategory: 'Respiratory',
            distinctPatientIds: Array.from({ length: 28 }, (_, i) => `pat-s-40-${i}`),
            caseCount: 28,
          },
        ];

        const modelFeed = await privacyService.produceGovernedModelInputFeed(
          benchmarkRawGroups,
          {
            actorUserId: req.authContext!.userId,
            actorRole: userAccount.role,
            requestId: req.id || 'unknown',
            releaseVersion: 'v1.0-2026',
            approvedDataLabel: 'SYNTHETIC_BENCHMARK',
            withComplementarySuppression: true,
          }
        );

        res.status(200).json({
          contractVersion: '1.0',
          thresholdApplied: privacyService.minimumThreshold,
          records: modelFeed,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /analytics/drilldown/:patientId
   * Explicitly ensures Administrator CANNOT retrieve identifiable records or drilldown
   * through analytics routes.
   */
  router.get(
    '/drilldown/:patientId',
    async (req: Request, res: Response): Promise<void> => {
      res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Drilldown into individual identifiable patient records is forbidden for administrators.',
          internalReasonCode: 'ADMIN_IDENTIFIABLE_ACCESS_FORBIDDEN',
          requestId: req.id,
        },
      });
    }
  );

  return router;
}
