# MediVault — Member 3 implementation

Runnable Express + SQLite consent and QR module for the four-person hackathon team. This is the Member 3 backend, not the complete MediVault application. All seeded records are synthetic. Clinician verification is a server-stored demo flag, not a real credential check. No external AI service is configured.

## 1. Install and start (10 minutes)

Install Node.js 24 LTS (minimum 22.13); Node's built-in SQLite is used. Extract this ZIP and open a terminal inside the `medivault-member3` folder.

```sh
npm ci
```

Windows PowerShell:

```powershell
$env:DEMO_MODE="true"
npm start
```

macOS/Linux:

```sh
DEMO_MODE=true npm start
```

Alternatively copy `.env.example` to `.env`, then run `node --env-file=.env src/server.js`. `npm start` does not automatically load .env.

The local API listens on http://127.0.0.1:4000. Keep the first terminal running. In a second terminal:

```sh
npm test
npm run demo
```

`npm test` creates isolated in-memory databases. `npm run demo` calls the running server and checks the working consent -> QR -> record -> revoke -> denial sequence. The server persists demo data in `data/medivault.sqlite`; this directory is excluded from git. Restarting preserves consents and revocations. Demo login is disabled unless DEMO_MODE=true; do not expose these known accounts publicly.

## 2. Demo accounts

All accounts use password `Demo-only-123!` (demo only).

| Email | Role | ID / patient record |
|---|---|---|
| patient.a@demo.test | Patient | patient-a / record-a |
| patient.b@demo.test | Patient | patient-b / record-b |
| clinician.a@demo.test | Verified clinician | clinician-a |
| clinician.b@demo.test | Different verified clinician | clinician-b |
| unverified@demo.test | Unverified clinician | unverified |
| admin@demo.test | Public-health admin | admin |

## 3. Run the flow manually with Postman

Use two separate login tokens; do not replace a patient token with the clinician token accidentally. Send JSON using Content-Type: application/json.

1. POST `/api/auth/login` with `{ "email": "patient.a@demo.test", "password": "Demo-only-123!" }`. Save `accessToken` as PATIENT_TOKEN.
2. Login as clinician.a@demo.test and save CLINICIAN_TOKEN.
3. POST `/api/consents` with Authorization: Bearer PATIENT_TOKEN and this body:

```json
{"patientId":"record-a","clinicianId":"clinician-a","scopes":["timeline:read","summary:generate"],"durationMinutes":15}
```

Save returned consentId.

4. POST `/api/qr/generate` with the patient Authorization header and `{ "consentId": "<returned ID>" }`. Save `token` as QR_TOKEN. The response also contains `qrDataUrl`; Member 1 can render it directly as an image. The QR encodes only the random token.
5. POST `/api/qr/resolve` with the clinician Authorization header and `{ "token": "<QR_TOKEN>" }`. Expect 200 and authorized patient metadata.
6. GET `/api/patients/record-a/timeline` with Authorization: Bearer CLINICIAN_TOKEN and X-Record-Access-Token: QR_TOKEN. Expect 200 and synthetic encounters.
7. POST `/api/consents/<consentId>/revoke` with the patient Authorization header. Expect 200.
8. Repeat step 6. Expect 403 ACCESS_DENIED. Changing to an admin, different clinician, or unverified clinician also denies access.

A QR does not replace login. Both authentication and live consent checks are required on each clinician request. Tokens are reusable by the selected clinician until expiry/revocation; single-use scanning is not implemented or claimed.

## 4. API contract for Member 1

| Method | Path | Body | Headers / response |
|---|---|---|---|
| POST | /api/auth/login | email, password | Demo; returns accessToken, user, expiresAt |
| POST | /api/auth/logout | None | Bearer login token; 204 |
| POST | /api/consents | patientId, clinicianId, scopes, durationMinutes | Patient Bearer; 201 consentId, expiresAt, scopes |
| GET | /api/consents | None | Patient Bearer; own consents and status |
| POST | /api/qr/generate | consentId | Patient Bearer; token, qrDataUrl, expiresAt |
| POST | /api/qr/resolve | token | Clinician Bearer; patientId, consentId, scopes, expiresAt |
| POST | /api/consents/:id/revoke | None | Patient Bearer; consentId, revoked |
| GET | /api/patients/:id/timeline | None | Bearer; clinician also sends X-Record-Access-Token |
| POST | /api/clinical-summary | patientId | Clinician Bearer + X-Record-Access-Token |
| GET | /api/audit | None | Patient Bearer; own events only |

Errors: 400 INVALID_INPUT; 401 AUTH_REQUIRED or INVALID_CREDENTIALS; 403 ACCESS_DENIED; 404 NOT_FOUND; 429 RATE_LIMITED; 503 SUMMARY_NOT_CONFIGURED.

```json
{"error":{"code":"ACCESS_DENIED","message":"Access is unavailable. Ask the patient to share again."}}
```

Frontend work: patient consent form, selected-clinician picker, QR image, revoke button; clinician scan/paste-token form; loading/error/access-denied states. Keep login and QR tokens in memory for this demo. Clear sensitive UI state on logout and denial. Use a dev proxy for `/api` to port 4000 rather than inventing a separate authentication system. No CORS configuration or frontend is included. Camera scanning belongs to Member 1; paste-token input is the fallback. Deployment needs HTTPS for camera permissions and sensitive API requests.

## 5. Integration with Member 2 (records/backend)

Agree now: user IDs, patient IDs, current-user object, scopes, header names, and who edits shared models. You own src/sharing.js; Member 2 owns shared authentication and records. app.js is a runnable reference server. Do not mount a second copy of its auth and timeline endpoints in a backend that already has them.

The shared policy interface is:

```js
sharing.authorizePatientAccess({
  actor: req.actor,             // trusted, authenticated server identity
  patientId: req.params.id,
  requiredScope: 'timeline:read',
  recordAccessToken: req.get('x-record-access-token')
});
```

The included implementation reloads role/verification from SQLite and checks live consent and token rows. It returns authorized patient context or throws ApiError. Member 2 must run it before any record retrieval, including detail/download/export routes added later. No general admin bypass is allowed on identifiable records. Patient self-access is permitted only for their own timeline; clinical summaries are clinician-only in this MVP.

This starter uses synchronous SQLite prepared statements. If the main team chooses MongoDB/PostgreSQL, preserve the public service interface and replace the persistence implementation together with Member 2. Async authorization calls must be awaited; use appropriate transaction boundaries. Do not silently keep SQLite as a separate identity database.

## 6. Integration with Member 4 (AI)

The summary endpoint already authorizes before record retrieval and rechecks authorization/session after the AI call. Supply a server-side function when creating the app:

```js
const { app } = createApp({
  db,
  demoMode: true,
  summarize: async (authorizedTimeline) => {
    // Call your approved AI service here. Never accept browser-provided history.
    // Return a concise summary plus source encounter IDs from the input.
    return yourSummaryService(authorizedTimeline);
  }
});
```

The placeholder identifier above is an integration example, not a supplied AI implementation. Without a function, authorized summary requests return 503 SUMMARY_NOT_CONFIGURED. Tests inject a labelled test function; test output is not a real AI feature. If consent is revoked while the request is in flight, the completed summary is withheld. Already submitted input cannot be withdrawn from the provider: use synthetic data for the hackathon.

Admin disease aggregates, k=10 suppression, forecasts, and analytics permissions are Member 4 work and are not implemented here. Admin is deliberately denied on all included identifiable record/audit endpoints.

## 7. File ownership and implementation order

| Time from your start | Task |
|---|---|
| 0–30 min | Install, run tests/demo, agree IDs and contracts with teammates |
| 30–90 min | Review store.js and sharing.js with Member 2; select shared database |
| 1.5–3 h | Integrate grant/generate/resolve/revoke routes into shared backend |
| 3–4 h | Member 2 applies authorization to record routes |
| 4–5 h | Member 1 connects QR and scan/paste forms |
| 5–6 h | Member 4 connects summary service with authorization |
| 6–8 h | Run security tests against integrated app; adapt seeded IDs |
| 8–10 h | Test deployed HTTPS build and rehearse revocation demo |

Merge small working changes. Have one owner edit shared router/model/lock files. Keep service names and JSON shapes stable. Never introduce client-controlled roles or verification flags.

## 8. Security behavior and limits

Included: hashed random QR/session tokens, scrypt demo password hashing, patient ownership, clinician binding, current verification checks, scope checks, expiry, idempotent revocation, prepared SQL, restricted audit data, no-store responses, simple single-process request limiting, server-side record retrieval, and summary reauthorization.

This is a local hackathon starter, not production certification. For real deployment Member 2 must provide production authentication, clinician verification, secret management, HTTPS/reverse-proxy configuration, persistent DB hosting, retention/access controls, and a shared rate limiter. No refresh tokens or distributed limiter are included. Server defaults to loopback. Do not return identifiable records through analytics or newly added endpoints. Revocation blocks subsequent authorized reads but cannot erase already viewed/downloaded information. Audit rows are not a tamper-proof audit system; database administrators can alter them. Consent mutations and audit inserts are separate in this starter; add transactional audit/outbox handling if durable compliance-grade auditing is required.

Design references: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html and https://nodejs.org/api/crypto.html
