# MediVault / Medviaduct — Security Demo & Verification Guide
**Member 3 Workstream Demonstration Protocol**

This document details the reproduction protocol for verifying all security guarantees, invariants, and audit trails implemented by Member 3.

---

## 1. Prerequisites & Windows PowerShell Quickstart

Execute these commands in Windows PowerShell from the project root (`medviaduct-security`):

```powershell
# 1. Install dependencies
npm install

# 2. Push database schema to PostgreSQL
npx prisma db push

# 3. Apply PostgreSQL append-only immutability trigger
psql -h 127.0.0.1 -p 5432 -U postgres -d medviaduct -f "prisma/append_only_audit.sql"

# 4. Seed idempotent synthetic test accounts
npm run db:seed

# 5. Run the full security test suite (All 27 automated tests)
npm test

# 6. Start the standalone security Express host
npm start
```

---

## 2. Seeded Demo Accounts (Synthetic Fixtures)

> [!NOTE]
> Clinician verification statuses in these fixtures are strictly seeded demo verification flags for testing and hackathon demonstration, NOT real medical license verifications.

| Account Label | Role | User ID (`UserId`) | Domain ID (`PatientId` / `ClinicianId`) | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Patient A** | `PATIENT` | `11111111-1111-4111-8111-111111111111` | `22222222-2222-4222-8222-222222222222` | Active |
| **Patient B** | `PATIENT` | `11111111-1111-4111-8111-111111111112` | `22222222-2222-4222-8222-222222222223` | Active |
| **Clinician A** | `CLINICIAN` | `33333333-3333-4333-8333-333333333331` | `44444444-4444-4444-8444-444444444441` | `DEMO_VERIFIED` (`true`) |
| **Clinician B** | `CLINICIAN` | `33333333-3333-4333-8333-333333333332` | `44444444-4444-4444-8444-444444444442` | `DEMO_VERIFIED` (`true`) |
| **Clinician Unverified** | `CLINICIAN` | `33333333-3333-4333-8333-333333333333` | `44444444-4444-4444-8444-444444444443` | `UNVERIFIED` (`false`) |
| **Administrator** | `ADMIN` | `55555555-5555-4555-8555-555555555555` | N/A | Active Admin |

---

## 3. Step-by-Step Security Walkthrough

### Step A: Patient A Creates Time-Bounded Consent for Clinician A
- **Endpoint:** `POST /api/consents`
- **Actor:** Authenticated Patient A
- **Payload:**
  ```json
  {
    "clinicianId": "44444444-4444-4444-8444-444444444441",
    "scopes": ["timeline:read", "clinical-summary:generate"],
    "durationMinutes": 30
  }
  ```
- **Result:** Returns `201 Created` with `status: "active"`, `effectiveStatus: "active"`, and server-calculated `expiresAt`.

### Step B: Patient A Generates Single-Use QR Token
- **Endpoint:** `POST /api/qr/generate`
- **Actor:** Authenticated Patient A
- **Payload:** `{ "consentId": "<consentId_from_step_A>" }`
- **Result:** Returns `200 OK` with payload `MEDVIADUCT:v1:<opaque_64_char_hex>`.
- **Security Check:** The raw token contains zero patient details, and only its SHA-256 hash is persisted.

### Step C: Clinician A Resolves QR Code into an Access Grant
- **Endpoint:** `POST /api/qr/resolve`
- **Actor:** Authenticated Clinician A
- **Payload:** `{ "token": "MEDVIADUCT:v1:<opaque_token>" }`
- **Result:** Returns `200 OK` with `accessGrantId`, `patientId`, and `expiresAt` (15 minutes, bounded by consent).

### Step D: Clinician A Accesses Authorized Timeline
- **Endpoint:** `GET /api/patients/22222222-2222-4222-8222-222222222222/timeline`
- **Actor:** Authenticated Clinician A
- **Header:** `X-Access-Grant-Id: <accessGrantId>`
- **Result:** Returns `200 OK` with timeline records.

### Step E: Administrator Denial
- **Scenario:** Administrator attempts to resolve QR or access patient timeline.
- **Result:** Denied with `403 Forbidden` (`FORBIDDEN_ROLE` / `ACCESS_DENIED`). Administrators are strictly forbidden from accessing identifiable clinical data or resolving patient invitations.

### Step F: Patient A Revokes Consent
- **Endpoint:** `POST /api/consents/<consentId>/revoke`
- **Actor:** Authenticated Patient A
- **Result:** Returns `200 OK` with `status: "revoked"`. Associated QR tokens and active grants are immediately revoked.

### Step G: Subsequent Access Fails
- **Scenario:** Clinician A re-attempts to fetch the timeline with the previous `accessGrantId`.
- **Result:** Denied with `403 Forbidden` (`ACCESS_DENIED`) because the centralized authorizer verifies that underlying consent is no longer active.

### Step H: Expired & Replayed QR Tokens Fail
- **Scenario:** Replay of the consumed token from Step B or an expired token.
- **Result:** Denied with `403 Forbidden` (`QR_ACCESS_UNAVAILABLE`).

---

## 4. Inspecting Audit Evidence Safely

All authorization decisions (allowed and denied) are persistently logged in the `audit_events` table. To protect patient privacy:
- The `safeResourceRefs` column records only opaque UUIDs and action metadata.
- Zero clinical diagnoses, prescription texts, patient names, or raw QR tokens are logged.
- The table is strictly append-only (PostgreSQL trigger prevents UPDATE and DELETE).

Developers can query the safe audit log using `psql`:

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d medviaduct -c "
SELECT 
  id, 
  timestamp, 
  \"actorRole\", 
  action, 
  outcome, 
  \"internalReasonCode\", 
  \"safeResourceRefs\" 
FROM audit_events 
ORDER BY timestamp DESC 
LIMIT 10;
"
```
