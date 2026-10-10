import { Router, json } from 'express';
import { SecurityDependencies, SystemClock } from './contracts/interfaces.js';
import { correlationMiddleware } from './middleware/correlation.js';
import { noStoreMiddleware } from './middleware/noStore.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createAuthMiddleware } from './auth/middleware.js';
import { AuditService } from './audit/service.js';
import { ConsentService } from './consent/service.js';
import { createConsentRouter } from './consent/routes.js';
import { QrService } from './qr/service.js';
import { createQrRouter } from './qr/routes.js';
import { EmergencyAccessService } from './emergency/service.js';
import { createEmergencyRouter } from './emergency/routes.js';
import { PrivacyBoundaryService } from './privacy/boundary.js';
import { createAnalyticsRouter } from './privacy/routes.js';
import { AccessAuthorizer, createAuthorizePatientAccessMiddleware } from './access/authorizer.js';
import { ClinicalSummarySecurityWrapper } from './access/member4Wrapper.js';

export interface SecurityModuleInstance {
  router: Router;
  authorizer: AccessAuthorizer;
  auditService: AuditService;
  consentService: ConsentService;
  qrService: QrService;
  emergencyService: EmergencyAccessService;
  privacyService: PrivacyBoundaryService;
  summaryWrapper: ClinicalSummarySecurityWrapper;
  authorizePatientAccessMiddleware: typeof createAuthorizePatientAccessMiddleware;
}

/**
 * Security router factory.
 * Assembles all security components with explicit dependency injection.
 * Does NOT hard-code any external member's implementations.
 */
export function createSecurityModule(deps: SecurityDependencies): SecurityModuleInstance {
  const clock = deps.clock ?? new SystemClock();

  // Instantiate security services
  const auditService = new AuditService(deps.securityRepo);
  const consentService = new ConsentService(
    deps.identityRepo,
    deps.securityRepo,
    auditService,
    clock
  );
  const qrService = new QrService(
    deps.identityRepo,
    deps.securityRepo,
    auditService,
    clock
  );
  const authorizer = new AccessAuthorizer(
    deps.identityRepo,
    deps.securityRepo,
    auditService,
    clock
  );
  const emergencyService = new EmergencyAccessService(
    deps.identityRepo,
    deps.securityRepo,
    auditService,
    clock
  );
  const privacyService = new PrivacyBoundaryService(auditService, {
    minimumGroupThreshold: 10,
  });
  const summaryWrapper = new ClinicalSummarySecurityWrapper(authorizer, auditService);

  const router = Router();

  // Global foundational security middleware
  router.use(correlationMiddleware);
  router.use(noStoreMiddleware);
  router.use(json({ limit: '100kb' })); // Bounded JSON body parsing

  // Authentication gate
  const authMiddleware = createAuthMiddleware(deps.authAdapter, deps.identityRepo);

  // Protected security subrouters
  router.use('/consents', authMiddleware, createConsentRouter(consentService));
  router.use('/qr', authMiddleware, createQrRouter(qrService));
  router.use(
    '/emergency-access',
    authMiddleware,
    createEmergencyRouter(emergencyService, deps.authAdapter, deps.identityRepo)
  );
  router.use(
    '/analytics',
    authMiddleware,
    createAnalyticsRouter(privacyService, deps.authAdapter, deps.identityRepo)
  );

  /**
   * GET /clinicians
   * Returns available verified clinicians for the patient consent picker.
   */
  router.get('/clinicians', authMiddleware, async (_req, res, next) => {
    try {
      const clinicians = deps.identityRepo.listAvailableClinicians
        ? await deps.identityRepo.listAvailableClinicians()
        : [];
      res.status(200).json(
        clinicians.map((c) => ({
          clinicianId: c.id,
          licenseNumber: c.licenseNumber,
          isVerified: c.isVerified,
          verificationStatus: c.verificationStatus,
          hasEmergencyAccessPermission: c.hasEmergencyAccessPermission,
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  // Central error handling
  router.use(errorHandler);

  return {
    router,
    authorizer,
    auditService,
    consentService,
    qrService,
    emergencyService,
    privacyService,
    summaryWrapper,
    authorizePatientAccessMiddleware: createAuthorizePatientAccessMiddleware,
  };
}

