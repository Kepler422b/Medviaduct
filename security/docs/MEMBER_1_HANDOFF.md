# MediVault / Medviaduct — Member 1 Frontend Handoff & Security Manual
**Track 02: Healthcare (HLTH-01) — Patient Health Records & Disease Trend Monitoring**  
**Member 3 Workstream: Frontend Security Integration & Component Contracts**

---

## 1. Quick Integration Overview

Member 1 does **NOT** need to redesign screens, build a new dashboard from scratch, or duplicate existing HTTP layers. This handoff provides a lightweight, framework-compatible typed client and concrete component contracts that wire seamlessly into your existing UI.

### A. Client Import & Initialization
Import [`MediVaultSecurityClient`](../src/security/client/apiHelpers.ts):

```typescript
import { MediVaultSecurityClient } from './security/client/apiHelpers';

// Initialize with your existing auth token getter (e.g., from AuthContext, Pinia, or session store)
export const securityClient = new MediVaultSecurityClient({
  baseUrl: '/api',
  getAuthToken: () => authStore.getAccessToken(),
  csrfToken: () => authStore.getCsrfToken?.() ?? null, // Optional CSRF header support
});
```

### B. Shared Authentication Transport
* **No Second Login:** Reuse Member 2's session / Bearer JWT tokens.
* **Header Attachment:** The client automatically injects `Authorization: Bearer <token>` on all requests.
* **CORS & Headers:** The backend accepts `Content-Type`, `Authorization`, `X-Access-Grant-Id`, `X-Request-Id`, and `X-CSRF-Token`.

---

## 2. Mandatory Frontend Security & State Rules

> [!CAUTION]
> **Zero LocalStorage Persistence for Clinical State:**
> 1. **In-Memory Only:** `accessGrantId`, raw QR tokens, and patient clinical records (timelines, medications, encounters) MUST be stored strictly in memory (React State/Context, Pinia, Vue reactive state, or Zustand).
> 2. **Never in LocalStorage / SessionStorage:** Storing clinical EHRs or access grants in browser storage is an immediate compliance violation.
> 3. **State Wipe on Transitions:** Clear all in-memory grants, tokens, and clinical data immediately upon:
>    - User logout.
>    - Switching user accounts or roles.
>    - Navigating away from a patient view.
> 4. **Informational Countdowns:** Timers (e.g. "Grant expires in 04:32") displayed in the UI are **informational**. The server clock is authoritative. If the server returns `401` or `403`, immediately clear the displayed clinical data.
> 5. **Data Retraction Invariant:** Clearing the current UI prevents continued browsing, but cannot retract data already delivered over the wire.

---

## 3. Exact Component Contracts & Behaviors

### Component 1: Patient Consent & QR Panel (`PatientConsentPanel`)

#### Responsibilities:
1. **Select Clinician:** Dropdown populated from `securityClient.listAvailableClinicians()`. Only verified clinicians (`isVerified: true`) can be selected.
2. **Choose Scopes:** Checkboxes for:
   - `timeline:read` (Required baseline)
   - `clinical-summary:generate` (Requires `timeline:read`)
3. **Set Duration:** Slider or picker (1 to 60 minutes; recommended default: 30 minutes).
4. **Grant Action:** Calls `securityClient.createConsent(...)`.
5. **Render Returned QR:** Calls `securityClient.generateQr(consent.id)` and renders `payload` (`MEDVIADUCT:v1:<opaque_token>`) as a standard QR code SVG or Canvas.
6. **Show Server Expiry:** Display countdown based on returned `expiresAt` (5 minutes for QR token, 30 minutes for consent).
7. **List / Revoke Consents:** Table of own consents via `securityClient.listConsents()`. Clicking "Revoke" calls `securityClient.revokeConsent(id)`, instantly revoking any issued QR code and active grants.

#### Minimal Implementation Recipe:
```typescript
// 1. Fetch verified clinicians
const clinicians = await securityClient.listAvailableClinicians();

// 2. Patient creates consent
const consent = await securityClient.createConsent({
  clinicianId: selectedClinicianId,
  scopes: ['timeline:read', 'clinical-summary:generate'],
  durationMinutes: 30,
});

// 3. Generate QR code
const qr = await securityClient.generateQr(consent.id);
// Pass qr.payload to <QRCodeSVG value={qr.payload} size={256} />
```

---

### Component 2: Clinician Scanner & Record Viewer (`ClinicianScanner`)

#### Responsibilities:
1. **Camera Scanning:** Stream webcam via `html5-qrcode` or standard barcode detection.
2. **Manual Payload Fallback (Required):** Text input box allowing clinicians to paste or type the `MEDVIADUCT:v1:...` code if the camera fails.
3. **Resolve Grant:** `POST /api/qr/resolve` with `{ token }` via `securityClient.resolveQr(token)`.
4. **Grant Expiry State:** Store returned `accessGrantId`, `patientId`, and `expiresAt` in memory.
5. **Fetch Authorized History:** Call `securityClient.fetchAuthorizedRecord(patientId, accessGrantId, 'timeline')`. The client automatically sends the mandatory `X-Access-Grant-Id: <grantId>` header!
6. **Generic Denial State:** If resolution or record fetch returns 403, display:  
   *"Access is unavailable. Ask the patient to share a fresh QR invitation."*  
   Clear any displayed patient data immediately.

#### Authorized Record Fetch Example:
```typescript
// 1. Resolve QR
const grant = await securityClient.resolveQr(scannedOrPastedToken);

// 2. Fetch authorized timeline (attaches X-Access-Grant-Id automatically)
const timeline = await securityClient.fetchAuthorizedRecord(
  grant.patientId,
  grant.accessGrantId,
  'timeline'
);

// 3. Fetch specific encounter if needed
const encounter = await securityClient.fetchAuthorizedRecord(
  grant.patientId,
  grant.accessGrantId,
  `encounters/${selectedEncounterId}`
);
```

---

### Component 3: Emergency Break-Glass Panel (`EmergencyAccessPanel`)

#### Responsibilities:
1. **Visibility Gate:** Visible in the UX **only for eligible clinicians** (`clinician.hasEmergencyAccessPermission === true && clinician.isVerified === true`).
   *(Note: The backend still strictly enforces this server-side, preventing UI bypass).*
2. **Explicit Reason Form:**
   - Dropdown with standardized reason codes:
     - `UNRESPONSIVE_TRAUMA`
     - `ACUTE_CARDIOVASCULAR_COLLAPSE`
     - `RESPIRATORY_ARREST`
     - `SEVERE_SEPSIS_SHOCK`
     - `ANAPHYLAXIS`
     - `ACUTE_NEUROLOGICAL_DEFICIT`
     - `IMMINENT_THREAT_TO_LIFE`
   - Clinical text justification: Textarea requiring **at least 10 characters** explaining the emergency.
3. **Separate Confirmation Action:** Modal with warning:  
   *"Emergency override is strictly audited and logged to PostgreSQL immutable audit partitions. Bedside clinical review only (bulk exports and downloads are blocked)."*
4. **Limited Scope & Duration Notice:** Server enforces fixed 5-minute duration and `timeline:read` scope. Display the returned notice banner:  
   `"Emergency access — audited — expires at [TIME]"` prominently at the top of the timeline.
5. **Early-Close Action:** A red *"End Emergency Session"* button calling `securityClient.revokeEmergencyAccess(grantId)` to terminate the session early.

#### Emergency Declaration Recipe:
```typescript
const emergency = await securityClient.requestEmergencyAccess({
  patientId: targetPatientId,
  reasonCode: 'UNRESPONSIVE_TRAUMA',
  reasonText: 'Patient unresponsive in ER resuscitation bay with severe trauma.',
  durationMinutes: 5,
});

// Display prominent notice banner:
// emergency.notice -> "Emergency access — audited — expires at 2026-10-10T12:05:00.000Z"
```

---

### Component 4: Patient Emergency Audit History (`PatientEmergencyHistory`)

#### Responsibilities:
1. **Safe Event Metadata:** Patients can view who accessed their record under emergency break-glass:
   - Date & Time.
   - Clinician license number.
   - Reason code (e.g. `UNRESPONSIVE_TRAUMA`).
   - Status (`active`, `expired`, `revoked`).
   - **Zero PII Leakage:** Free-text clinical justifications are protected and withheld from general logs.
2. **Revoke Active Emergency Grant:** If an emergency grant is currently active, patient can click *"Revoke Active Emergency Access"* calling `securityClient.revokeEmergencyAccess(grant.id)`.

---

## 4. Error Code to UI Message Mapping

Use [`mapSecurityError`](../src/security/client/errorMapping.ts) to translate backend responses:

| HTTP Status | Backend Error Code | UI Title | User Message | Recommended Action | Wipe In-Memory State? |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **401** | `AUTH_REQUIRED` | Session Expired | Your medical session has ended or is invalid. | Prompt to log in again. | ✅ **Yes** |
| **403** | `ACCESS_DENIED` | Access Unavailable | Access is unavailable. Consent was revoked or expired. | Ask patient to share a fresh QR invitation. | ✅ **Yes** |
| **403** | `QR_ACCESS_UNAVAILABLE` | QR Unavailable | This QR invitation is expired or already used. | Ask patient to generate a new QR code. | No (Keep input open) |
| **403** | `FORBIDDEN_ROLE` | Role Unauthorized | Your account cannot access individual patient records. | Admins can only view aggregate surveillance. | ✅ **Yes** |
| **403** | `EMERGENCY_ACCESS_UNAUTHORIZED` | Permission Required | Profile not provisioned for emergency break-glass. | Contact hospital clinical administration. | ✅ **Yes** |
| **400** | `INVALID_INPUT` | Invalid Request | Input does not meet clinical constraints. | Ensure reason text is at least 10 chars. | No |
| **429** | `RATE_LIMIT_EXCEEDED` | Rate Limited | Too many security requests received. | Wait 60 seconds before retrying. | No |

---

## 5. Security Client API Method Reference

| Method | Actor | Description | Arguments | Returns |
| :--- | :--- | :--- | :--- | :--- |
| `listAvailableClinicians()` | Patient | Gets verified clinicians for dropdown | None | `Promise<AvailableClinician[]>` |
| `createConsent(input)` | Patient | Creates time-bounded consent | `CreateConsentRequest` | `Promise<ConsentDto>` |
| `listConsents()` | Patient | Lists own consents | None | `Promise<ConsentDto[]>` |
| `revokeConsent(id)` | Patient | Instantly revokes consent & grants | `consentId: string` | `Promise<ConsentDto>` |
| `generateQr(consentId)` | Patient | Issues single-use 5-min QR token | `consentId: string` | `Promise<GenerateQrResponse>` |
| `resolveQr(token)` | Clinician | Exchanges QR code for Access Grant | `token: string` | `Promise<ResolveQrResponse>` |
| `requestEmergencyAccess(input)` | Clinician | Declares 5-min emergency break-glass | `RequestEmergencyAccessInput` | `Promise<EmergencyAccessResponse>` |
| `listEmergencyAccess()` | Clinician / Patient | Lists emergency access records | None | `Promise<SafeEmergencyGrantMetadata[]>` |
| `revokeEmergencyAccess(id)` | Clinician / Patient | Terminates emergency grant early | `grantId: string` | `Promise<RevokeEmergencyResponse>` |
| `fetchAuthorizedRecord(patId, grantId, path)` | Clinician | Fetches clinical records with grant header | `patientId, grantId, path` | `Promise<T>` |
