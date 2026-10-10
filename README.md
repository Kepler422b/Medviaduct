# Health BridgeAI

> **Clinical Case & Disease Intelligence** — a proposed clinical research and decision-support platform that connects a clinician’s case with relevant published evidence and disease activity.

[![Status](https://img.shields.io/badge/status-project%20proposal-blue)](#implementation-status)
[![License](https://img.shields.io/badge/license-TBD-lightgrey)](#license)

## Project overview

Health BridgeAI is designed to help clinicians and medical researchers explore complex cases alongside relevant published case reports, current medical research, disease trends, and evidence. Its intended workflow is:

**Enter a clinical case → extract useful clinical features → find comparable cases and research → review disease activity → inspect cited evidence.**

Health BridgeAI is a research and decision-support concept. It is not intended to replace professional judgment, clinical guidelines, or local public-health advice, and it must not be represented as an autonomous diagnosis system.

## Problem

Reviewing an unusual or complex case can require searching across separate literature databases, case-report sources, guidelines, and public-health datasets. Manually reconciling those sources takes time, and a result without traceable citations is difficult to assess.

## Proposed solution

Health BridgeAI brings case entry, similar-case discovery, research discovery, and disease-trend exploration into one workspace. An AI-assisted service may help extract search features and summarize retrieved evidence, while source references let the user verify material independently. The value depends on the quality, coverage, and freshness of connected data sources; those integrations are not established as implemented in the available project material.

## Core modules

The project summary describes **four core modules**:

1. **My Case** — enter or upload a clinical case and review its structured information and analysis.
2. **Similar Cases** — discover published case reports with comparable symptoms, investigations, or outcomes.
3. **Disease Trends** — explore disease activity, outbreaks, and epidemiological trends from connected sources.
4. **Latest Research** — find recent research and relevant evidence, with source citations for review.

The proposed backend also includes evidence records, saved research, and notifications as supporting capabilities.

## Intended end users

- **Clinicians and doctors** researching complex or unusual cases.
- **Medical researchers** exploring case literature and current publications.
- **Public-health and epidemiology users** reviewing disease activity, when suitable data integrations are available.

Access to patient-related information should be limited to authorized users and handled under the applicable institutional and legal requirements.

## Features and experience

### Clinical intelligence workflow

- Case entry and, if implemented, document upload.
- Case analysis and structured clinical features.
- Similar-case and research discovery.
- Disease-trend views and evidence references.
- Saved research and notifications as proposed supporting features.

### Interactive 3D design direction

The project prompt calls for a polished, responsive healthcare experience with interactive 3D elements and visual storytelling. The referenced design direction is an airy ivory/paper background, soft lavender and blue watercolor-like gradients, botanical details, organic shapes, restrained shadows, and elegant typography. Three.js was recommended for 3D work. This describes the intended design; it does not verify that a running frontend or any specific interaction has been implemented.

### QR Center (proposed feature)

The conversation explicitly says the QR feature is missing and requests it as a new addition. The intended page is `/qr-center`, linked from the main navigation near Latest Research and Saved Research. It should generate, display, download, scan, and resolve QR codes for Health BridgeAI resources such as a case report, case analysis, similar-case results, research collection, evidence report, or disease-trend report.

**Privacy requirement:** encode only an opaque, revocable reference or secure link. Never encode patient details, clinical notes, or other sensitive data in the QR payload. Resolving a link must enforce authentication or explicit authorization, access scope, expiry/revocation policy, and audit controls appropriate to the deployment. A QR code is a pointer, not an access-control mechanism. QR generation, scanning, and share-link resolution are requirements, not verified existing capabilities.

## Implementation status

The available source is a project-summary conversation and design/build prompts, not a checked-out application repository. The conversation establishes requirements and suggested architecture, but it does not establish which components have been implemented. Treat the following as the safest current status:

| Area | Status supported by available material |
|---|---|
| Four clinical intelligence modules | Described as project scope; implementation unverified |
| 3D interactive frontend | Requested design direction; implementation unverified |
| QR Center | Explicitly requested as a missing feature; implementation unverified |
| Node/Express/TypeScript backend, PostgreSQL, Prisma | Recommended architecture; implementation unverified |
| JWT, bcrypt, Zod, upload handling | Recommended technologies; implementation unverified |
| OpenAI-compatible AI service | Proposed integration layer; provider and working integration unverified |
| PubMed, Crossref, public-health APIs | Possible future integrations; not established as connected |
| Docker, tests, deployment | No configuration or results supplied; unverified |

Do not advertise external medical data integrations, production readiness, or clinical validation until confirmed in the codebase and tested against the named sources.

## Architecture (proposed)

A suggested full-stack layout is a React + TypeScript client and a Node.js + Express + TypeScript REST API. PostgreSQL stores application records through Prisma. The API separates routes/controllers, validation, services, and persistence. Authentication protects user-specific data. An AI adapter and medical-data adapters isolate provider-specific logic so integrations can be added or replaced independently.

```text
Browser (React / TypeScript / optional Three.js)
                 │ HTTPS / JSON
                 ▼
       Express REST API (TypeScript)
       ├── Authentication and authorization
       ├── Case, research, trends, evidence, QR services
       ├── AI provider adapter (optional; not verified)
       └── Medical-source adapters (planned / not verified)
                 │ Prisma
                 ▼
             PostgreSQL
```

Uploads, if enabled, should be validated and stored outside the public web root. Production deployments may use private object storage rather than local disk.

## Suggested technology stack

| Layer | Suggested technology | Status |
|---|---|---|
| Frontend | React, TypeScript | Proposed; verify repository |
| 3D | Three.js (optionally through a React integration) | Design recommendation |
| Backend | Node.js, Express, TypeScript | Recommended in conversation |
| Database / ORM | PostgreSQL, Prisma | Recommended in conversation |
| Validation | Zod | Recommended in conversation |
| Authentication | JWT and bcrypt | Recommended in conversation; secure configuration required |
| AI | Provider-neutral, OpenAI-compatible service adapter | Proposed; provider not specified |
| Research discovery | PubMed / Crossref adapters | Future integrations; not verified |
| Disease trends | Epidemiological or public-health data adapters | Future integrations; not verified |
| Uploads | Multer initially; private S3-compatible storage for production | Suggested only |

## Project structure

The following is a **suggested structure**, not a claim about files currently present:

```text
medintel/
├── frontend/                     # React + TypeScript application
│   └── src/
│       ├── components/
│       ├── pages/                 # My Case, Similar Cases, Trends, Research, QR Center
│       ├── services/              # API client
│       └── three/                 # Interactive 3D scenes (if used)
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── utils/
│   │   ├── types/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── uploads/                   # local development only; keep private
│   ├── package.json
│   └── .env.example
├── docker-compose.yml             # optional local PostgreSQL setup
└── README.md
```

## API overview (proposed contract)

No API implementation or OpenAPI specification was supplied. These routes are a suggested starting contract; verify and adapt them to the actual server before relying on them.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Authenticate and issue a session/token |
| `GET` | `/api/auth/me` | Return the authenticated user |
| `POST` | `/api/cases` | Create a clinical case |
| `GET` | `/api/cases` | List the current user’s cases |
| `GET` | `/api/cases/:caseId` | Retrieve an authorized case |
| `POST` | `/api/cases/:caseId/analyze` | Request case analysis |
| `GET` | `/api/cases/:caseId/similar` | Retrieve similar-case results |
| `GET` | `/api/research` | Search or list research results |
| `POST` | `/api/research/:paperId/save` | Save a research item |
| `GET` | `/api/trends` | Retrieve disease-trend data |
| `GET` | `/api/evidence/:id` | Retrieve an evidence record and source metadata |
| `POST` | `/api/qr/shares` | Create a protected, revocable share reference |
| `GET` | `/api/share/:token` | Resolve a share after authorization checks |
| `DELETE` | `/api/qr/shares/:shareId` | Revoke a share reference |

Protect patient and account data with server-side authorization on every resource request. Avoid putting sensitive values in URLs, logs, analytics, or QR payloads.

## Database model outline (proposed)

The backend prompt names these Prisma models. Fields and relations below are conceptual; the actual schema must define ownership, retention, constraints, indexes, and access policy.

- **User** — account identity, password hash, role/status, timestamps.
- **ClinicalCase** — owner, case metadata, permitted clinical content, timestamps.
- **CaseAnalysis** — case, analysis output, model/provider metadata, timestamps.
- **SimilarCase** — source case/record reference, match rationale or score, provenance.
- **ResearchPaper** — title, authors, abstract/summary, publication metadata, DOI or source identifier.
- **DiseaseTrend** — disease, geography, time period, measure, source and update metadata.
- **Evidence** — evidence/source reference associated with a case, analysis, or research item.
- **SavedResearch** — user-to-research-paper relationship.
- **Notification** — recipient, content/type, read state, timestamps.

The earlier prompt also calls for relations between users and their clinical cases, saved research, and notifications; cases and their analyses, similar cases, and evidence; and research papers and evidence. A QR sharing implementation would need an additional share/token model (or equivalent secure persistence) with resource scope, owner, expiry, revocation, and access history. The supplied model list does not establish that such a model exists.

## Local setup (template)

These steps assume the proposed monorepo layout above. They are not confirmed to work until matching manifests, scripts, and Prisma schema exist in the project.

### Prerequisites

- Node.js LTS and npm (or the package manager used by the repository).
- Docker Desktop for the optional local PostgreSQL service, or an existing PostgreSQL instance.
- Git.

### 1. Get the source

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_REPOSITORY_DIRECTORY>
```

### 2. Configure environment

Copy the relevant example file(s) to local `.env` files and fill in values from the variable reference below. Never commit real secrets.

### 3. Start PostgreSQL (optional Docker template)

If a `docker-compose.yml` is added using the example later in this README:

```bash
docker compose up -d postgres
```

### 4. Install dependencies and initialize the database

Run commands from the relevant `frontend/` or `backend/` directory, adapting them to actual package scripts:

```bash
npm install
npx prisma generate
npx prisma migrate dev
```

### 5. Start the applications

Use the scripts defined by the checked-in package manifests. A common development convention is:

```bash
npm run dev
```

No exact ports or working commands can be promised until the application manifests are available. Do not run migrations against production with development commands.

## Environment variables (suggested)

Names are examples for the proposed stack. Add only variables the implementation actually reads, and document defaults in the source.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Runtime mode (`development`, `test`, `production`) |
| `PORT` | API listening port |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | High-entropy secret for signing tokens; keep private and rotate safely |
| `JWT_EXPIRES_IN` | Token lifetime, for example `15m` |
| `CLIENT_ORIGIN` | Allowed browser origin for CORS |
| `AI_PROVIDER` | Optional AI adapter selection |
| `AI_API_KEY` | Optional provider credential; do not expose to the browser |
| `AI_BASE_URL` | Optional compatible-provider endpoint |
| `PUBMED_API_KEY` | Optional credential if the chosen literature API supports/requires one |
| `UPLOAD_DIR` | Development upload directory, if local uploads are enabled |
| `MAX_UPLOAD_SIZE_MB` | Upload size limit |
| `QR_PUBLIC_BASE_URL` | Public base URL used when creating share links |
| `QR_SHARE_TTL_HOURS` | Default share-link lifetime, if temporary sharing is supported |

Use a secrets manager in deployed environments. Keep `.env`, credentials, patient data, and uploaded files out of version control.

## Docker and PostgreSQL (optional template)

No Docker configuration was supplied. The following is a minimal **development-only** PostgreSQL service example; choose and pin a supported PostgreSQL image version before using it. Provide `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` through a local, untracked environment file.

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - medintel_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  medintel_pgdata:
```

For production, use managed PostgreSQL or an appropriately secured database deployment, private networking, backups, access controls, monitoring, and tested migrations. Do not expose a production database port publicly.

## Authentication and access control

The proposed stack uses bcrypt for password hashing and JWT-based authentication. A production implementation should use a modern work factor, short-lived access tokens, carefully managed refresh/session behavior, HTTPS, rate limits on authentication endpoints, secure error handling, and server-side authorization for every user-owned resource. Never store plaintext passwords or rely on frontend checks to protect data. Define roles and least-privilege rules before handling real clinical information.

## AI and medical data integrations

The AI layer should be provider-neutral and kept behind a backend service interface. It may assist with case feature extraction, literature matching, or evidence summaries, but the prompts do not establish a working provider, model, retrieval pipeline, evaluation, or validation. Treat AI output as assistive and unverified; preserve source provenance and make citations inspectable.

PubMed, Crossref, and external epidemiological/public-health data sources were mentioned as candidates for later connection. They are **planned possibilities**, not confirmed integrations. Before implementation, confirm each provider’s API terms, licensing, attribution, rate limits, data freshness, and allowed use. Disease-trend results should display source, geography, time period, and retrieval/update time. Do not claim comprehensive coverage or real-time surveillance without evidence.

## QR security and privacy

- Keep sensitive clinical data out of QR payloads; encode only an opaque, high-entropy token or non-sensitive URL.
- Store token hashes where feasible; enforce expiry, revocation, and narrowly scoped resource access.
- Require authentication or deliberate share authorization when resolving a token; a hard-to-guess URL alone is insufficient protection.
- Avoid exposing identifiers in analytics, referrer headers, logs, or error messages. Use HTTPS and suitable cache/referrer policies.
- Log share creation, access, and revocation in a privacy-conscious audit trail.
- Offer immediate revocation and establish a retention policy.
- Scan uploaded QR images safely and validate resolved URLs to reduce malicious-link and SSRF risks.
- Review applicable privacy, security, and institutional requirements before any real patient-data use.

## Development commands

The repository did not include package manifests, so exact scripts are unknown. Common commands for the proposed stack may include:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npx prisma migrate dev
npx prisma studio
```

Use only commands that are defined by the checked-in `package.json` files. Add clear root-level scripts or document which directory each command runs from.

## Testing and quality

No test suite or results were supplied. Before calling the project production-ready, add and run tests for:

- Authentication, authorization, and ownership boundaries.
- Case creation, analysis flow, and validation failures.
- Research and trend adapters, including rate limits and unavailable sources.
- Citation and provenance rendering.
- QR creation, expiry, revocation, unauthorized resolution, and payload privacy.
- Upload type/size validation and safe storage, if uploads are enabled.
- Responsive layouts, keyboard access, and reduced-motion behavior for animation.

Use synthetic or properly de-identified fixtures. Never put real patient data in test snapshots, logs, or public demo seed data. Report actual test commands and outcomes in project documentation once verified.

## Deployment notes

Deployment configuration is not established by the source material. A production release should use HTTPS, environment-specific secrets, a private database, automated backups and restore checks, least-privilege service accounts, logging/monitoring with sensitive fields redacted, dependency and vulnerability review, migration planning, and a documented incident/retention process. Store uploads in private object storage with access controls and malware/type checks. Configure CORS narrowly, set secure headers and rate limits, and validate external API failure behavior. Complete security, privacy, and clinical workflow review before processing real patient information.

## Limitations

- The project requirements and proposed architecture do not verify a working application.
- Medical literature and epidemiology coverage depends on future integrations and source terms.
- AI-generated summaries or matches may be incomplete or wrong and require expert review.
- Disease trends can lag source reporting and may not represent local conditions.
- This project is not a diagnostic device or substitute for clinical judgment.
- No regulatory, privacy, security, or clinical validation status was provided.
- QR Center is a requested feature, but implementation and share controls are unverified.

## Roadmap

1. Confirm the actual frontend, backend, and data models against the project repository.
2. Deliver the four core modules with clear source attribution and useful empty/error states.
3. Implement secure accounts, role/ownership checks, and database migrations.
4. Add literature-source adapters and document their limits and terms.
5. Add disease-trend sources with provenance, geography, and update timestamps.
6. Evaluate AI-assisted extraction and matching against reviewed, de-identified examples.
7. Build QR Center with scoped, expiring, revocable share references and privacy tests.
8. Polish responsive 3D interactions, accessibility, performance, and deployment operations.

## Contributing

Contributions are welcome once the repository’s implementation conventions are established. Please open an issue to discuss substantial changes, keep pull requests focused, document configuration changes, and include appropriate tests. Do not submit patient-identifiable data, secrets, or copyrighted datasets without authorization. Add contribution guidelines and a code of conduct if the project adopts them.

## License

**License: TBD.** No license was specified in the available project material. Until a license is selected and added to the repository, reuse and redistribution permissions are not granted by this README. Replace this section with the chosen license and add its full text (for example, an `LICENSE` file) before publishing as open source.

## Acknowledgments

- Project requirements summarized from the Health BridgeAI project conversation.
- External source providers, datasets, and design assets should be credited here after they are selected and integrated.

---

**Repository owners:** Replace this line with maintainer or organization details.
