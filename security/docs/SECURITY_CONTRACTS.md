# MediVault / Medviaduct — Security Contracts & Integration Specification
**Member 3 (Security Workstream) — Architecture & Contract Guide**

---

## 1. Domain Identifier Separation

To prevent cross-domain elevation, identity confusion, and broken object-level authorization (BOLA), MediVault strictly enforces three separate identifier types:

| Identifier | Domain Entity | Primary Key Model | Description |
| :--- | :--- | :--- | :--- |
| **`UserId`** | Account Credentials | `UserAccount.id` | Represents the authentication account (e.g. login session, Supabase auth UID, Cognito sub). |
| **`PatientId`** | Subject of Care | `PatientProfile.id` | Represents the clinical patient whose records are accessed. |
| **`ClinicianId`** | Healthcare Practitioner | `ClinicianProfile.id` | Represents the licensed clinician who receives temporary access grants. |

> [!IMPORTANT]
> A `UserId` is **NEVER** interchangeable with a `PatientId` or `ClinicianId`.
> Client-supplied headers (e.g. `X-User-Role`, `X-Patient-Id`) are never trusted. Roles, profile linkages, and verification statuses are resolved exclusively from trusted server database records.

> [!NOTE]
> **Representative Access Scope Decision:**
> In accordance with the selected MVP path, the optional representative delegation path is omitted; direct patient-owned consent satisfies the selected architecture. Representative authority is never accepted from client-supplied request parameters or form checkboxes.

---

## 2. Integration Interfaces for Member 2 (Core Backend & Auth)

Member 2 must implement or provide adapters for these two core interfaces:

### `AuthenticationAdapter`
Defined in [`src/security/contracts/interfaces.ts`](../src/security/contracts/interfaces.ts):

```typescript
export interface AuthenticationAdapter {
  authenticate(req: Request): Promise<AuthenticatedUser | null>;
}
```

- **Contract Rules:**
  1. Inspects the incoming HTTP request (`Authorization: Bearer <token>`, session cookie, or JWT).
  2. Cryptographically validates the session/token against Member 2's authentication authority (e.g. Supabase, OAuth2, or custom session store).
  3. Returns `{ userId: string }` if valid, or `null` if invalid/missing.
  4. Fails closed (`null`) if authentication cannot be definitively proven.

### `IdentityRepository`
Defined in [`src/security/contracts/interfaces.ts`](../src/security/contracts/interfaces.ts):

```typescript
export interface IdentityRepository {
  getUserAccount(userId: string): Promise<UserAccountRecord | null>;
  getPatientByUserId(userId: string): Promise<PatientProfileRecord | null>;
  getClinicianByUserId(userId: string): Promise<ClinicianProfileRecord | null>;
  getClinicianById(clinicianId: string): Promise<ClinicianProfileRecord | null>;
  getPatientById(patientId: string): Promise<PatientProfileRecord | null>;
}
```

- **Contract Rules:**
  1. `getUserAccount`: Resolves account status (`isActive`) and server-trusted role (`PATIENT` | `CLINICIAN` | `ADMIN`).
  2. `getPatientByUserId`: Resolves the patient profile from the authenticated account.
  3. `getClinicianByUserId` & `getClinicianById`: Resolves clinician profile, license number, and verified status (`isVerified === true`, `hasEmergencyAccessPermission === true`).

---

## 3. Persistent Database Models (Prisma / PostgreSQL)

Member 3 provides the following tables in PostgreSQL (schema in [`prisma/schema.prisma`](../prisma/schema.prisma)):

1. **`consents`**:
   - `id` (UUID, PK)
   - `patientId` (UUID, FK -> `patient_profiles.id`)
   - `clinicianId` (UUID, FK -> `clinician_profiles.id`)
   - `scopes` (Text array: `['timeline:read', 'clinical-summary:generate']`)
   - `status` (`active` | `revoked`)
   - `createdAt`, `expiresAt`, `revokedAt`, `createdByUserId`
2. **`qr_tokens`**:
   - `id` (UUID, PK)
   - `consentId` (UUID, FK -> `consents.id`)
   - `tokenHash` (VARCHAR(64), UNIQUE — SHA-256 hash only. Raw token is never stored)
   - `createdAt`, `expiresAt`, `consumedAt`, `revokedAt`
3. **`access_grants`**:
   - `id` (UUID, PK)
   - `consentId` (UUID, FK -> `consents.id`)
   - `patientId` (UUID, FK -> `patient_profiles.id`)
   - `clinicianId` (UUID, FK -> `clinician_profiles.id`)
   - `scopes` (Text array)
   - `createdAt`, `expiresAt`, `revokedAt`
4. **`emergency_access_grants`**:
   - `id` (UUID, PK)
   - `patientId` (UUID, FK -> `patient_profiles.id`)
   - `clinicianId` (UUID, FK -> `clinician_profiles.id`)
   - `reasonCode` (Allowlisted code: `UNRESPONSIVE_TRAUMA`, `ACUTE_CARDIOVASCULAR_COLLAPSE`, `RESPIRATORY_ARREST`, `SEVERE_SEPSIS_SHOCK`, `ANAPHYLAXIS`, `ACUTE_NEUROLOGICAL_DEFICIT`, `IMMINENT_THREAT_TO_LIFE`)
   - `reasonText` (Bounded clinical explanation, 10-500 chars)
   - `scope` (Strictly fixed to `timeline:read`)
   - `createdAt`, `expiresAt` (strictly server-calculated 5 minutes max), `revokedAt`, `createdByUserId`, `requestId`
5. **`audit_events`**:
   - `id` (UUID, PK)
   - `timestamp`, `actorUserId`, `actorRole`, `action`, `outcome` (`allowed` | `denied`), `internalReasonCode`
   - `safeResourceRefs` (JSON — bounded identifiers only; **zero** patient names, medical history, raw justifications, or raw tokens)
   - `requestId` (UUID)
   - **Enforced Database Invariant:** Protected by PostgreSQL trigger `audit_events_no_update_delete` which blocks all `UPDATE` and `DELETE` operations at the database engine level.

---

## 4. Endpoints Provided for Member 1 (Frontend)

All endpoints require authentication and return `Cache-Control: no-store`:

### `POST /api/consents`
- **Role:** Patient only (`PATIENT`)
- **Body:**
  ```json
  {
    "clinicianId": "44444444-4444-4444-8444-444444444441",
    "scopes": ["timeline:read", "clinical-summary:generate"],
    "durationMinutes": 30
  }
  ```
- **Response (201):**
  ```json
  {
    "id": "c1a2b3c4-...",
    "patientId": "22222222-...",
    "clinicianId": "44444444-...",
    "scopes": ["timeline:read", "clinical-summary:generate"],
    "status": "active",
    "effectiveStatus": "active",
    "createdAt": "2026-10-10T12:00:00.000Z",
    "expiresAt": "2026-10-10T12:30:00.000Z",
    "revokedAt": null
  }
  ```

### `GET /api/consents`
- **Role:** Patient only (`PATIENT`)
- **Response (200):** Array of consents for the authenticated patient with calculated `effectiveStatus` (`active` | `expired` | `revoked`).

### `POST /api/consents/:id/revoke`
- **Role:** Patient only (`PATIENT`)
- **Response (200):** Revoked consent. Instantly revokes associated QR tokens and active access grants.

### `POST /api/qr/generate`
- **Role:** Patient only (`PATIENT`)
- **Body:** `{ "consentId": "uuid" }`
- **Response (200):**
  ```json
  {
    "payload": "MEDVIADUCT:v1:8f9a2b...",
    "expiresAt": "2026-10-10T12:05:00.000Z"
  }
  ```

### `POST /api/qr/resolve`
- **Role:** Clinician only (`CLINICIAN`)
- **Body:** `{ "token": "MEDVIADUCT:v1:8f9a2b..." }` or raw token hex
- **Response (200):**
  ```json
  {
    "accessGrantId": "g1a2b3...",
    "patientId": "22222222-...",
    "scopes": ["timeline:read"],
    "expiresAt": "2026-10-10T12:15:00.000Z"
  }
  ```

---

### `POST /api/emergency-access`
- **Role:** Verified Clinician only with `hasEmergencyAccessPermission === true`
- **Body:**
  ```json
  {
    "patientId": "22222222-2222-4222-8222-222222222222",
    "reasonCode": "UNRESPONSIVE_TRAUMA",
    "reasonText": "Severe multi-trauma resuscitation in ER shock trauma unit"
  }
  ```
- **Response (201):**
  ```json
  {
    "emergencyGrantId": "beaee7a7-4f4e-4e36-b0e8-a261c15fbe44",
    "patientId": "22222222-2222-4222-8222-222222222222",
    "clinicianId": "44444444-4444-4444-8444-444444444441",
    "scope": "timeline:read",
    "scopes": ["timeline:read"],
    "expiresAt": "2026-10-10T12:05:00.000Z",
    "reasonCode": "UNRESPONSIVE_TRAUMA",
    "notice": "Emergency access — audited — expires at 2026-10-10T12:05:00.000Z"
  }
  ```

### `POST /api/emergency-access/:id/revoke`
- **Role:** Clinician or Subject Patient
- **Response (200):** Revokes emergency grant immediately. Subsequent requests blocked.

### `GET /api/emergency-access`
- **Role:** Patient (sees safe metadata without private clinician reason text) or Clinician (sees own declared grants).
- **Response (200):** Safe list of emergency grants with `effectiveStatus` and standard notice.

---

### `GET /api/analytics/aggregates`
- **Role:** Public Health Administrator (`ADMIN`) or Clinician (`CLINICIAN`)
- **Query Parameters:** `region`, `timeBucket`, `conditionCategory`
- **Response (200):**
  ```json
  {
    "thresholdApplied": 10,
    "aggregates": [
      {
        "region": "District-North",
        "timeBucket": "2026-W40",
        "conditionCategory": "Respiratory",
        "caseCount": 118,
        "suppressionStatus": "available",
        "thresholdApplied": 10
      },
      {
        "region": "District-North",
        "timeBucket": "2026-W40",
        "conditionCategory": "Waterborne",
        "caseCount": null,
        "suppressionStatus": "suppressed_unavailable",
        "thresholdApplied": 10
      }
    ]
  }
  ```
- **CRITICAL PRIVACY GUARANTEE:**
  - When $rawCount < 10$, `caseCount` is strictly `null` (marked as `suppressed_unavailable`), **NEVER ZERO**!
  - Identifiable patient fields are strictly stripped and rejected.

---

## 5. Reusable Central Authorization Boundary (`authorizePatientAccess`)

Exported from [`src/security/access/authorizer.ts`](../src/security/access/authorizer.ts):

```typescript
const result = await authorizer.authorizePatientAccess({
  actorUserId: req.authContext.userId,
  patientId: req.params.patientId,
  requiredScope: 'timeline:read',
  accessGrantId: req.headers['x-access-grant-id'],
  requestId: req.id,
  resourcePath: 'patient_timeline',
});
```

### Access Modes Distinguished:
1. `PATIENT_SELF`: Own record access only (`patientId === actorProfile.id`). Denies AI summary generation.
2. `NORMAL_CONSENT`: Requires verified clinician, matching unexpired grant, matching unexpired underlying consent, and matching scopes.
3. `EMERGENCY_OVERRIDE`: Requires verified clinician with `hasEmergencyAccessPermission === true`, matching unexpired emergency grant, fixed `timeline:read` scope. Bulk download/export/AI summaries prohibited.
4. **No Fallback Invariant:** If normal consent verification fails, execution aborts immediately with 403 `ACCESS_DENIED`. It never falls back automatically to emergency mode.

### Member 2 Protected Clinical Routes
Member 2 routes must mount `createAuthorizePatientAccessMiddleware`:

| Route | Scope | Resource Name |
| :--- | :--- | :--- |
| `GET /api/patients/:id/timeline` | `timeline:read` | `patient_timeline` |
| `GET /api/patients/:id/encounters/:encounterId` | `timeline:read` | `encounter_detail` |
| `GET /api/patients/:id/medications` | `timeline:read` | `patient_medications` |
| `GET /api/patients/:id/download` | `timeline:read` | `patient_record_download` |
| `GET /api/patients/:id/export` | `timeline:read` | `patient_record_export` |
| `GET /api/patients/:id/records/search` | `timeline:read` | `patient_record_search` |

```typescript
// Route mount example
app.get(
  '/api/patients/:id/encounters/:encounterId',
  authMiddleware,
  createAuthorizePatientAccessMiddleware(authorizer, 'timeline:read', {
    resourceName: 'encounter_detail',
  }),
  (req, res) => {
    // req.accessResult contains authorizedRole, grantId, accessMode, isEmergency
  }
);
```

---

## 6. Member 4 AI Summary Security Integration (`ClinicalSummarySecurityWrapper`)

Defined in [`src/security/access/member4Wrapper.ts`](../src/security/access/member4Wrapper.ts):

```typescript
const wrapper = new ClinicalSummarySecurityWrapper(authorizer, auditService);

const summary = await wrapper.executeProtectedSummaryGeneration(
  {
    actorUserId: req.authContext.userId,
    patientId: req.params.id,
    accessGrantId: req.headers['x-access-grant-id'],
    requestId: req.id,
  },
  async (patientId) => {
    // 1. Source records retrieved strictly SERVER-SIDE
    return await clinicalDb.getPatientHistory(patientId);
  },
  async (records) => {
    // 2. AI model invoked with server-retrieved records
    return await geminiModel.generateClinicalSummary(records);
  }
);
```

### Guarantees:
1. **Scope:** Requires normal consent-backed `clinical-summary:generate`. Emergency grants CANNOT generate summaries.
2. **Server-Side Retrieval:** Client-supplied histories are never accepted.
3. **Double-Authorization (Post-Check):** Rechecks authorization after model latency before releasing summary to detect mid-flight consent revocations.
4. **Cache Reauthorization:** `wrapper.reauthorizeCachedSummaryAccess()` rechecks authorization before reading or releasing cached summaries.

---

## 7. Supabase Direct Access & RLS Analysis

> [!IMPORTANT]
> **Server Connection Privileges vs. RLS:**
> - The Express backend and Prisma connect using PostgreSQL service credentials (`DATABASE_URL`), which bypass end-user Row Level Security (RLS).
> - End-user RLS policies do NOT protect privileged Prisma queries. Centralized application authorization (`authorizePatientAccess`) is the required barrier.
> - To prevent browsers from bypassing the backend and directly reading/writing Supabase tables via PostgREST, [`prisma/supabase_rls_lockdown.sql`](../prisma/supabase_rls_lockdown.sql) enforces:
>   - `ALTER TABLE ... FORCE ROW LEVEL SECURITY` on all tables.
>   - `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated`.
>   - Deny policies on all tables for PostgREST roles.
>   - Direct browser access to Supabase data tables is completely disabled.

---

## 8. Standardized Error Response Format

All errors strictly follow this schema:

```json
{
  "error": {
    "code": "ACCESS_DENIED",
    "message": "You do not have permission to access this resource.",
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
}
```

| HTTP Status | Error Code | Scenario |
| :--- | :--- | :--- |
| **401** | `UNAUTHENTICATED` | Missing or invalid authentication token. |
| **401** | `ACCOUNT_INACTIVE` | Account exists but is disabled/inactive. |
| **403** | `FORBIDDEN_ROLE` | User role lacks permission for the endpoint. |
| **403** | `ACCESS_DENIED` | Authorization check failed (missing grant, wrong clinician, cross-patient access, or expired consent). |
| **403** | `QR_ACCESS_UNAVAILABLE` | Generic non-disclosing error for invalid, expired, consumed, revoked, or wrong-clinician QR token. |
| **403** | `CLINICIAN_NOT_VERIFIED` | Clinician has not received seeded/demo verification. |
| **403** | `FORBIDDEN_EMERGENCY_ACCESS` | Clinician lacks explicit server-provisioned break-glass permission. |
| **404** | `NOT_FOUND` / `CONSENT_NOT_FOUND` | Resource does not exist or belongs to another user (non-disclosing). |
| **400** | `VALIDATION_ERROR` | Schema validation error or forged fields detected. |
| **429** | `RATE_LIMIT_EXCEEDED` | Request limit threshold exceeded. |
