# MediVault / Medviaduct — Member 3 Integration Guide
**Practical Integration Manual for Members 1, 2, and 4**

This guide provides drop-in instructions for integrating the security, consent, QR, and authorization modules built by Member 3 into the broader hackathon MVP.

---

## 1. Integration Instructions for Member 1 (Frontend)

Member 1 is responsible for the user interface (login screens, patient dashboard, clinician workspace, timeline view).

### A. Install or Import the Security Client
Import [`MediVaultSecurityClient`](../src/security/client/apiHelpers.ts) into your frontend codebase:

```typescript
import { MediVaultSecurityClient } from './security/client/apiHelpers';

// Initialize with a function that retrieves the active auth session token
const securityClient = new MediVaultSecurityClient('/api', () => {
  return sessionStore.getAccessToken(); // e.g. from in-memory AuthContext
});
```

### B. Frontend Security Rules (Mandatory)
1. **Memory-Only State:**
   - Store temporary `accessGrantId` and QR `payload` strictly in application memory (e.g., React Context, Pinia, or Vue reactive state).
   - **DO NOT** store `accessGrantId`, raw QR tokens, or patient timeline records in `localStorage` or `sessionStorage`.
2. **Clear on State Transitions:**
   - Clear all in-memory grants and tokens immediately upon logout, role change, or when navigating away from a patient.
3. **Informational Countdowns:**
   - Timers (e.g. "Grant expires in 14:32") in the UI are informational. The backend server clock is authoritative.
   - Always catch `401` and `403` HTTP errors gracefully and redirect or prompt to re-scan.
4. **Manual Code Fallback:**
   - Provide a text input for clinicians so they can manually type or paste the code if the camera scanner fails to read the QR image.

### C. Example Flow: Patient Consent & QR Generation
```typescript
// 1. Patient creates consent
const consent = await securityClient.createConsent({
  clinicianId: selectedClinicianId,
  scopes: ['timeline:read', 'clinical-summary:generate'],
  durationMinutes: 30,
});

// 2. Patient generates QR code
const qr = await securityClient.generateQr(consent.id);
// Display qr.payload ("MEDVIADUCT:v1:...") via QRCode SVG component
```

### D. Example Flow: Clinician QR Resolution & Timeline Fetch
```typescript
// 1. Clinician scans or types QR token
const grantResult = await securityClient.resolveQr(scannedPayload);

// Store grantResult.accessGrantId and grantResult.patientId in Memory Context
clinicianStore.setActiveGrant({
  accessGrantId: grantResult.accessGrantId,
  patientId: grantResult.patientId,
  expiresAt: grantResult.expiresAt,
});

// 2. Clinician fetches patient timeline
const timeline = await securityClient.fetchAuthorizedTimeline(
  grantResult.patientId,
  grantResult.accessGrantId
);
```

---

## 2. Integration Instructions for Member 2 (Core Backend & Supabase)

Member 2 owns user authentication, the core Express app, database migrations, and patient record endpoints.

### A. Use the Ready-to-Use `SupabaseAuthAdapter`
We have provided a zero-dependency, production-ready adapter at [`src/security/auth/supabaseAuthAdapter.ts`](../src/security/auth/supabaseAuthAdapter.ts) that validates Supabase JWTs directly against the Supabase Auth API:

```typescript
import { SupabaseAuthAdapter } from './security/auth/supabaseAuthAdapter';

// Automatically uses process.env.SUPABASE_URL and process.env.SUPABASE_ANON_KEY
const supabaseAuthAdapter = new SupabaseAuthAdapter();

// Or pass options explicitly:
// const supabaseAuthAdapter = new SupabaseAuthAdapter({
//   supabaseUrl: process.env.SUPABASE_URL,
//   supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
// });
```

If you prefer using your existing `@supabase/supabase-js` client instance directly:

```typescript
import { Request } from 'express';
import { AuthenticationAdapter, AuthenticatedUser } from './security/contracts/interfaces';

export class Member2SupabaseAuthAdapter implements AuthenticationAdapter {
  async authenticate(req: Request): Promise<AuthenticatedUser | null> {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return null;

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return null;

    // Return the authenticated account UID
    return { userId: user.id };
  }
}
```

### B. Supabase Database Connection & Migration
1. Set your Supabase connection string in `.env`:
   ```bash
   # Supabase Transaction Pooler (recommended):
   DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```
2. Push Member 3's tables (`consents`, `qr_tokens`, `access_grants`, `emergency_access_grants`, `audit_events`) to your Supabase PostgreSQL:
   ```bash
   npx prisma db push
   ```
3. Run the append-only trigger in Supabase SQL Editor:
   - Run the script in [`prisma/append_only_audit.sql`](../prisma/append_only_audit.sql) to prevent audit log tampering.

### C. CRITICAL: Lockdown Direct Browser Access (PostgREST)
Because Supabase exposes an auto-generated REST API directly to the internet (`https://<ref>.supabase.co/rest/v1`), browsers with `anon` keys could bypass Member 3's consent and emergency checks if tables are left unprotected.
- Execute [`prisma/supabase_rls_lockdown.sql`](../prisma/supabase_rls_lockdown.sql) in your **Supabase Dashboard -> SQL Editor**.
- This enforces RLS and revokes permissions from `anon` and `authenticated` roles, ensuring **all access traverses your Express API and Member 3's authorization boundary**.

### D. Protecting Clinical Record Endpoints
Any endpoint releasing patient records MUST be protected by `createAuthorizePatientAccessMiddleware`:

```typescript
import { createAuthorizePatientAccessMiddleware } from './security/access/authorizer';

// Protect timeline
app.get(
  '/api/patients/:id/timeline',
  authMiddleware,
  createAuthorizePatientAccessMiddleware(securityModule.authorizer, 'timeline:read'),
  async (req, res) => {
    // Verified: req.accessResult contains actorRole, actorId, and grantId
    const records = await db.timeline.findMany({ where: { patientId: req.params.id } });
    res.json(records);
  }
);
```

---

## 3. Integration Instructions for Member 4 (AI Summaries & Forecasting)

Member 4 provides AI-generated clinical summaries and analytics.

### A. Use `ClinicalSummarySecurityWrapper`
Do NOT call LLM APIs directly from client-supplied health data. Use the provided wrapper from [`src/security/access/member4Wrapper.ts`](../src/security/access/member4Wrapper.ts):

```typescript
import { ClinicalSummarySecurityWrapper } from './security/access/member4Wrapper';

const summarySecurityWrapper = new ClinicalSummarySecurityWrapper(
  securityModule.authorizer,
  securityModule.auditService
);

app.post('/api/patients/:id/generate-summary', authMiddleware, async (req, res, next) => {
  try {
    const accessGrantId = req.headers['x-access-grant-id'] as string;

    const summary = await summarySecurityWrapper.executeProtectedSummaryGeneration(
      {
        actorUserId: req.authContext.userId,
        patientId: req.params.id,
        accessGrantId,
        requestId: req.id,
      },
      // 1. Fetch records strictly server-side (Member 2's DB)
      async (patientId) => {
        return await fetchPatientEhrRecordsServerSide(patientId);
      },
      // 2. Invoke Member 4's AI model
      async (records) => {
        return await member4AiModel.generateSummary(records);
      }
    );

    res.json({ summary });
  } catch (err) {
    next(err);
  }
});
```

### B. Security Guarantees for Member 4
1. **Pre-Flight Authorization:** Validates `clinical-summary:generate` scope and clinician verification before querying EHR data or calling the model.
2. **Server-Side Data Source:** Model input comes from verified server records, never client requests.
3. **Mid-Flight Revocation Protection:** Re-authorizes immediately after LLM execution. If the patient revoked consent during model processing, the generated summary is withheld.
4. **Audit Enforcement:** Releasing the summary fails closed if audit logging encounters a database outage.
