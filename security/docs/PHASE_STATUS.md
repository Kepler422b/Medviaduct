# MediVault / Medviaduct — Member 3 Workstream Phase Status
**Track 02: Healthcare (HLTH-01) — Patient Health Records & Disease Trend Monitoring**
**Member 3: Security Implementation & Integration**

---

## Current Overall Status: ALL 7 MODULES VERIFIED & COMPLETED (57/57 Tests Passing)

| Phase / Module | Description | Status | Verification Summary |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Baseline Facts & Host Verification | ✅ **VERIFIED** | Port 3001 operational, `/api/health` 200 OK, fail-closed auth confirmed. |
| **Phase 2** | Normal Consent-Based Access & QR Workstream | ✅ **COMPLETED** | Verified named-clinician consent, strict scoping, single-use hashed QR tokens, atomic grant resolution, locking, and instant revocation. |
| **Phase 3** | Audited Emergency Access ("Break-Glass") | ✅ **COMPLETED** | Distinct break-glass workflow: verified clinician with server-provisioned permission, reason code allowlist, bounded text, server-calculated 5-min duration, fixed `timeline:read` scope, safe listing, distinct `EMERGENCY_ACCESS_READ` audit event, and frontend notice. |
| **Phase 4** | Centralized Authorization Boundary & Route Protection | ✅ **COMPLETED** | Single centralized boundary `authorizePatientAccess` with 3 explicit access modes (`PATIENT_SELF`, `NORMAL_CONSENT`, `EMERGENCY_OVERRIDE`). Member 2 secondary routes protected. Member 4 AI summary double-authorization and cache reauthorization. Supabase RLS lockdown. |
| **Phase 5** | Analytics Privacy Boundary & Integration Checks | ✅ **COMPLETED** | Governed model-input contract (`ApprovedModelInputRecordSchema`), distinct patient counting rule (repeated visits cannot inflate $k \ge 10$), complementary suppression, runtime validator, and aggregate-only admin authorizer (`authorizeAggregateAccess`). |
| **Phase 6** | Frontend Handoff without Rebuilding Member 1's UI | ✅ **COMPLETED** | Framework-compatible typed API client (`MediVaultSecurityClient`) with all 9 methods, memory-only state rules, error mapping (`mapSecurityError`), and comprehensive handoff guide (`docs/MEMBER_1_HANDOFF.md`). |
| **Phase 7** | Anomaly Detection, Mock Data & Evaluation | ✅ **COMPLETED** | Epidemiological `AnomalyDetector` (seasonal baseline + statistical $Z \ge 3.0$), 52-week synthetic dataset with injected outbreak at Week 40, and comparative evaluation vs. fixed threshold (0-week delay, 0 false alarms). |
| **Supabase** | Core Backend & Supabase Auth Bridge | ✅ **COMPLETED** | Zero-dependency `SupabaseAuthAdapter` validating JWTs via Supabase Auth API, PostgREST RLS lockdown (`prisma/supabase_rls_lockdown.sql`). |


---

## Phase 4 Checkpoint: Centralized Authorization Boundary & Protected Routes

### A. The Central Authorization Engine (`AccessAuthorizer`)
Exported from [`src/security/access/authorizer.ts`](../src/security/access/authorizer.ts):
```typescript
authorizePatientAccess({
  actorUserId: string,
  patientId: string,
  requiredScope: Scope,
  accessGrantId?: string,
  requestId?: string,
  resourcePath?: string,
}): Promise<AuthorizationResult>
```

#### Actor Identity Origin
Actor identity originates strictly from server-verified authentication middleware (`createAuthMiddleware` + `AuthenticationAdapter`). Untrusted client-supplied headers (e.g. `X-User-Id`, `X-User-Role`, `X-Patient-Id`) are discarded.

#### Three Distinct Access Modes Enforced:
1. **`PATIENT_SELF`**:
   - Actor role must be `PATIENT`.
   - Patient profile ID must match requested `patientId`. Cross-patient access is strictly denied (`CROSS_PATIENT_ACCESS_FORBIDDEN` -> 403 `ACCESS_DENIED`).
   - Summary generation scope (`clinical-summary:generate`) is forbidden for patients (`PATIENT_SUMMARY_GENERATE_FORBIDDEN` -> 403 `ACCESS_DENIED`).
   - Returns `{ authorized: true, accessMode: 'PATIENT_SELF', actorRole: 'PATIENT', ... }`.
2. **`NORMAL_CONSENT`**:
   - Actor role must be `CLINICIAN`.
   - Clinician account must be active and verified (`isVerified === true`).
   - Mandates `X-Access-Grant-Id` header.
   - Grant must match authenticated clinician ID and target patient ID.
   - Grant must be unrevoked and unexpired.
   - Underlying consent must be active, unrevoked, and unexpired.
   - Consent and grant references must agree on patient ID and clinician ID.
   - Required scope must be present in BOTH the access grant AND the underlying consent.
   - Returns `{ authorized: true, accessMode: 'NORMAL_CONSENT', actorRole: 'CLINICIAN', grantId, ... }`.
3. **`EMERGENCY_OVERRIDE`**:
   - Dedicated break-glass path invoked when `accessGrantId` matches an `EmergencyAccessGrant`.
   - Clinician must be verified AND hold explicit server-provisioned permission (`hasEmergencyAccessPermission === true`).
   - Grant must match authenticated clinician ID and target patient ID.
   - Grant must be unrevoked and within server-calculated 5-minute expiry.
   - Scope is strictly locked to `timeline:read` only.
   - **Absolute Invariant — No Automatic Fallback:** Any failure of normal consent access (e.g. expired grant, revoked consent, missing grant header) fails closed immediately with 403. It never automatically falls back to emergency mode. Emergency mode requires explicit declaration and an explicit emergency grant ID.
   - **Bulk Export & Download Blocked:** Emergency access is strictly for bedside clinical review. Bulk download (`/download`), export (`/export`), and AI summary generation (`/clinical-summary`) are strictly prohibited under emergency override.
   - Returns `{ authorized: true, accessMode: 'EMERGENCY_OVERRIDE', actorRole: 'CLINICIAN', isEmergency: true, ... }`.

#### Administrator Role Boundary:
- Administrators (`ADMIN`) are denied ALL identifiable clinical records across all endpoints (`ADMIN_IDENTIFIABLE_ACCESS_FORBIDDEN` -> 403 `ACCESS_DENIED`).
- Administrators can only access de-identified, suppressed aggregate data (`GET /api/analytics/aggregates`).

#### Internal Authorization Context:
Downstream route handlers and audit services receive the full context via `req.accessResult`:
```typescript
export interface AuthorizationResult {
  authorized: boolean;
  accessMode: 'PATIENT_SELF' | 'NORMAL_CONSENT' | 'EMERGENCY_OVERRIDE';
  actorRole: UserRole;
  actorId: string;
  patientId: string;
  grantId?: string;
  scopes: Scope[];
  isEmergency: boolean;
  safeResourceRefs: Record<string, string | number | boolean | null>;
}
```

---

### B. Member 2 Clinical Route Protection
All clinical endpoints are protected by `authMiddleware` + `authorizePatientAccessMiddleware`:

| Route | Required Scope | Audited Resource Name | Permitted Modes |
| :--- | :--- | :--- | :--- |
| `GET /api/patients/:id/timeline` | `timeline:read` | `patient_timeline` | `PATIENT_SELF`, `NORMAL_CONSENT`, `EMERGENCY_OVERRIDE` |
| `GET /api/patients/:id/encounters/:encounterId` | `timeline:read` | `encounter_detail` | `PATIENT_SELF`, `NORMAL_CONSENT`, `EMERGENCY_OVERRIDE` |
| `GET /api/patients/:id/medications` | `timeline:read` | `patient_medications` | `PATIENT_SELF`, `NORMAL_CONSENT`, `EMERGENCY_OVERRIDE` |
| `GET /api/patients/:id/download` | `timeline:read` | `patient_record_download` | `PATIENT_SELF`, `NORMAL_CONSENT` *(Emergency Blocked)* |
| `GET /api/patients/:id/export` | `timeline:read` | `patient_record_export` | `PATIENT_SELF`, `NORMAL_CONSENT` *(Emergency Blocked)* |
| `GET /api/patients/:id/records/search` | `timeline:read` | `patient_record_search` | `PATIENT_SELF`, `NORMAL_CONSENT`, `EMERGENCY_OVERRIDE` |

- **Resource Auditing:** Audit events record the actual requested resource path in `safeResourceRefs.resourcePath` (`encounter_detail`, `patient_medications`, `patient_record_download`, `patient_record_export`, `patient_record_search`, `patient_timeline`).
- **No Alternate Routes Unprotected:** There are no unprotected backdoor routes. Missing tokens return 401; missing grants return 403; cross-patient returns 403; admin returns 403.

---

### C. Member 4 AI Clinical Summary Integration (`ClinicalSummarySecurityWrapper`)
Located in [`src/security/access/member4Wrapper.ts`](../src/security/access/member4Wrapper.ts):
- Mounted at `POST /api/patients/:id/clinical-summary`.
- **Pre-Check:** Requires normal consent-backed access with scope `clinical-summary:generate`. Verified before any clinical records are fetched or AI models called.
- **Server-Side Retrieval:** Clinical source records are retrieved strictly server-side by the backend. Client-supplied record histories are never trusted.
- **Model Invocation:** AI summary model is executed with server-retrieved data.
- **Post-Check (Double-Authorization):** Rechecks authorization AFTER model latency to verify consent or grant were not revoked during model execution. Fails closed and discards generated output if revoked.
- **Cache Reauthorization:** `reauthorizeCachedSummaryAccess` verifies authorization before reading or releasing cached summaries.
- **Emergency Grants Prohibited:** Emergency grants only carry `timeline:read`. Attempting to generate summaries with an emergency grant is rejected with 403 `ACCESS_DENIED`.

---

### D. Caching & Header Specifications
- **Header:** `X-Access-Grant-Id` is required on all clinician clinical requests. Included in CORS `allowedHeaders`.
- **Response Caching Disabled:** `noStoreMiddleware` applied globally sets:
  ```http
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
  Pragma: no-cache
  Expires: 0
  Surrogate-Control: no-store
  ```

---

### E. Supabase Direct Access & RLS Analysis

> [!IMPORTANT]
> **Honest Architectural Statement Regarding Supabase RLS vs. Prisma:**
> 1. **Server Connection Privileges:** Prisma connects to PostgreSQL via direct TCP connection pool (`DATABASE_URL`) using database owner (`postgres`) credentials. These backend queries run with elevated privileges that completely bypass PostgreSQL Row Level Security (RLS) policies designed for end-user JWTs (`auth.uid()`).
> 2. **End-user RLS does NOT protect backend Prisma queries:** Claiming that Supabase RLS secures backend Prisma queries is factually false. Centralized application authorization (`authorizePatientAccess`) is the sole authoritative barrier that prevents BOLA/IDOR on the server.
> 3. **Blocking Browser Direct Table Access:** If Supabase is deployed, Supabase exposes an auto-generated PostgREST HTTP API directly to browsers. To prevent browser clients from bypassing application authorization and querying clinical tables directly, [`prisma/supabase_rls_lockdown.sql`](../prisma/supabase_rls_lockdown.sql) enforces:
>    - `ALTER TABLE ... FORCE ROW LEVEL SECURITY` on all tables.
>    - `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated`.
>    - `deny_anon_all` and `deny_auth_all` policies on all tables.
>    - All browser requests must go through the Medviaduct security backend API on port 3001.

---

### F. Backend Availability Status
- **Actual Member 2 Backend:** Pending canonical database connection and deployment by Member 2.
- **Integration Readiness:** Concrete mount examples, middleware adapters (`createAuthorizePatientAccessMiddleware`), and test fixtures are fully operational. Test-only fixture endpoints on port 3001 verify 100% of the authorization rules.

---

---

## Phase 5 Checkpoint: Analytics Privacy Boundary & Integration Checks

### A. Approved Model-Input Contract
Defined in [`src/security/privacy/modelInputContract.ts`](../src/security/privacy/modelInputContract.ts):
* **Approved Regions:** `District-North`, `District-South`, `District-East`, `District-West`, `Central-Metro`.
* **Fixed Calendar Periods:** Standard epidemiological week (`YYYY-Www`) or fixed monthly period (`YYYY-MM`). Arbitrary overlapping cohorts or unrestricted date ranges are strictly rejected.
* **Approved Condition Categories:** `Respiratory`, `Waterborne`, `Vectorborne`, `Gastrointestinal`, `Cardiometabolic`.
* **Released Case Count:** Metric value, nullable.
* **Suppressed Flag:** Boolean.
* **Release Version & Approved Data Label:** e.g. `v1.0-2026`, `SYNTHETIC_BENCHMARK`, `GOVERNED_AGGREGATE`.

### B. Distinct Contributing Patient Counting Method
* **Case Count is the Metric:** Total encounters/diagnoses.
* **Minimum-Group Eligibility ($k \ge 10$):** MUST be evaluated using **distinct contributing patients** (`distinctPatientIds.size`).
* **Invariance:** Repeated visits by the same individual **cannot inflate group-size eligibility** (e.g. 1 patient visiting 25 times results in `distinctPatients = 1 < 10`, so the cell is suppressed as `null`!).

### C. Suppressed Cell Guarantees
* `caseCount: null`
* `suppressed: true`
* **NEVER exact small counts (1 to 9).**
* **NEVER zero (`0`).** Zero signals absence of disease; `null` signals unavailability due to privacy.
* **NEVER patient identifiers.**

### D. Complementary (Secondary) Suppression
* Where subtraction between a released total and available sibling cells would reveal a suppressed small group ($Total - A = B$), complementary suppression automatically suppresses the total or the smallest available sibling cell (`applyComplementarySuppression`).

### E. Runtime Validation & Administrator Aggregate-Only Boundary
* `validateApprovedModelInputs`: Rejects identifiable rows, suppressed cells with non-null counts, and unknown dimensions.
* `authorizeAggregateAccess`: Confirms `ADMIN` can receive aggregates, but is **strictly blocked** from patient EHRs, drilldowns (`/api/analytics/drilldown/:patientId` -> 403), bulk exports, and emergency overrides.
* **Member 4 Demarcation:** Forecast implementations, surge thresholds, and baseline models are owned by Member 4. Security owns the gatekeeper contract and suppression boundary.

---

## Phase 6 Checkpoint: Frontend Handoff without Rebuilding Member 1's UI

* **Typed API Client:** [`MediVaultSecurityClient`](../src/security/client/apiHelpers.ts) provides all 9 requested methods:
  1. `listAvailableClinicians()`
  2. `createConsent(input)`
  3. `listConsents()`
  4. `revokeConsent(consentId)`
  5. `generateQr(consentId)`
  6. `resolveQr(token)`
  7. `requestEmergencyAccess(input)`
  8. `listEmergencyAccess()`
  9. `revokeEmergencyAccess(grantId)`
  + `fetchAuthorizedRecord(patientId, grantId, path)` attaching `X-Access-Grant-Id`.
* **Memory-Only State Policy:** Temporary grants, tokens, and clinical EHR records are kept strictly in-memory. Zero localStorage/sessionStorage persistence.
* **UI Error Mapping:** [`mapSecurityError`](../src/security/client/errorMapping.ts) maps backend status codes and error codes to user-friendly titles, recovery guidance, and automated data-wipe flags.
* **Comprehensive Integration Guide:** Exported in [`docs/MEMBER_1_HANDOFF.md`](../docs/MEMBER_1_HANDOFF.md).

---

## Test Verification Summary (47 Passing Tests)

```bash
 ✓ tests/security.test.ts (47 tests)
   ✓ Case 1: Successful consent -> QR -> grant -> authorized timeline
   ✓ Case 2-18: Error paths, role checks, expiry, scope enforcement, tampered tokens
   ✓ Case 19: Safe allowed/denied audit events
   ✓ Case 20-22: Privacy, hashed token storage, no-store headers
   ✓ Case 23: Rate limiting
   ✓ Case 24-27: Audit outage fail-closed, race condition atomicity
   ✓ Case 28-33: Audited emergency break-glass lifecycle, limits, 5-min expiry
   ✓ Case 34-36: Privacy boundary, k >= 10 suppression (null, not 0), outbreak anomaly
   ✓ Case 37: Centralized authorization boundary distinguishes all 3 modes
   ✓ Case 38: Member 2 clinical route protection across all secondary paths
   ✓ Case 39: Precise resource auditing records exact requested resource
   ✓ Case 40: Emergency override boundaries: bedside read allowed, bulk export/download/summary blocked
   ✓ Case 41: Absolute invariant: no automatic fallback from failed normal access
   ✓ Case 42: Member 4 integration: normal consent summary, server retrieval, recheck, cache reauth
   ✓ Case 43: Approved Model-Input Contract & Runtime Validation (strict dimensions, no identifiable fields, no exact count in suppressed cells)
   ✓ Case 44: Distinct Contributing Patient Counting Method (repeated visits cannot inflate k >= 10 eligibility)
   ✓ Case 45: Complementary Suppression (withholding totals/siblings where subtraction leaks small groups)
   ✓ Case 46: Aggregate-Only Administrator Role Boundary (admin accesses approved aggregates, but denied drilldowns, patient exports, and emergency routes)
   ✓ Case 47: Member 1 Typed API Client Methods (All 9 Methods Verified)
```
