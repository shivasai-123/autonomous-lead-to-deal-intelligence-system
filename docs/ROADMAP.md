# System Development Roadmap: Autonomous Lead-to-Deal CRM

This roadmap outlines the complete 10-phase engineering lifecycle for the Autonomous Lead-to-Deal Intelligence System.

---

## Progress Overview

| Phase | Title | Status |
| :--- | :--- | :--- |
| **PHASE 1** | Planning, Architecture & Foundation | ✅ **COMPLETED** |
| **PHASE 2** | Database Design & Prisma Setup | ✅ **COMPLETED** |
| **PHASE 3** | Authentication & User Management | ✅ **COMPLETED** |
| **PHASE 4** | CRM Core — Leads, Companies & Activities | ✅ **COMPLETED** |
| **PHASE 5** | Sales Pipeline & Deal Management | ✅ **COMPLETED** |
| **PHASE 6** | Lead Intelligence — Scoring, Priority & Automation | ✅ **COMPLETED** |
| **PHASE 7** | Next-Best-Action Recommendation Engine | ⏳ **NOT IMPLEMENTED YET** |
| **PHASE 8** | AI Features & Explanations | ⏳ **NOT IMPLEMENTED YET** |
| **PHASE 9** | Dashboard, Analytics, Notifications & UI Polish | ⏳ **NOT IMPLEMENTED YET** |
| **PHASE 10** | Testing, Security, Deployment & Documentation | ⏳ **NOT IMPLEMENTED YET** |

---

## Detailed Phase Breakdown

### PHASE 1: Planning, Architecture & Foundation
- **Status**: ✅ **COMPLETED**
- **Deliverables**:
  - Technical analysis of autonomous CRM platform requirements.
  - Multi-tier system architecture specification (Client ↔ REST API ↔ Express ↔ Prisma ↔ PostgreSQL).
  - High-level database entity design and relational mapping.
  - REST API conventions, standardized response envelopes, and error handling protocols.
  - Monorepo folder hierarchy with workspaces (`client`, `server`, `docs`).
  - Express backend initialization with `/api/health` diagnostic probe.
  - React frontend initialization with Vite, Tailwind CSS, React Router v6, and Axios client.
  - Environment templates (`.env.example`), `.gitignore`, and foundational documentation.

---

### PHASE 2: Database Design & Prisma Setup
- **Status**: ✅ **COMPLETED**
- **Deliverables**:
  - Relational PostgreSQL data schema configured in `server/prisma/schema.prisma`.
  - Implemented 11 core models: `User`, `Role`, `Company`, `Lead`, `LeadActivity`, `LeadScore`, `Deal`, `PipelineStage`, `Recommendation`, `Notification`, and `AuditLog`.
  - Configured enums: `LeadStatus`, `LeadPriority`, `ActivityType`, `DealStatus`, `RecommendationType`, `RecommendationStatus`, `NotificationType`.
  - Applied referential actions (`Cascade`, `SetNull`, `Restrict`), unique constraints, and performance indexes.
  - Executed initial Prisma migration (`20261008182056_init_crm_models`) against PostgreSQL `autonomous_crm` database.
  - Generated Prisma Client (`@prisma/client` v5.22.0).
  - Executed foundational database seed script (`server/prisma/seed.js`) populating system roles (`ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`), 8 ordered pipeline stages, and development verification data.
  - Verified database schema, relational queries, constraints, and Decimal currency handling via `server/verify-db.js`.

---

### PHASE 3: Authentication & User Management
- **Status**: ✅ **COMPLETED**
- **Deliverables**:
  - Secure password hashing using `bcryptjs` with cost factor 12.
  - JWT generation and verification utility with configurable expiration (`JWT_EXPIRES_IN`).
  - Implemented authentication endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
  - Enforced secure registration: public self-registration defaults strictly to role `SALES_REPRESENTATIVE`.
  - Implemented authorization middleware: `requireAuth` and `requireRole(...roles)` (`ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`).
  - Implemented user directory and administration endpoints: `GET /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id/status`, `PATCH /api/users/:id/role`.
  - Sanitized API response objects ensuring `passwordHash` and server secrets are never returned.
  - Built frontend `AuthContext` with login, register, logout, session restoration, and Axios 401 handling.
  - Built polished `LoginPage`, `RegisterPage`, and `UsersPage` with SaaS styling, input validation, and show/hide password toggles.
  - Created `ProtectedRoute` foundation with role-based route guards.
  - Built and verified automated 10-test authentication and RBAC suite (`server/verify-auth.js`).

---

### PHASE 4: CRM Core — Leads, Companies & Activities
- **Status**: ✅ **COMPLETED**
- **Deliverables**:
  - Non-destructive Prisma migration (`20261009043001_add_lead_archival_and_flags`) adding `isArchived`, `isDuplicate`, `isSuspicious`, and `suspiciousReason` to `Lead` model.
  - Implemented Company management backend (`GET /api/companies`, `POST /api/companies`, `GET /api/companies/:id`, `PATCH /api/companies/:id`) with case-insensitive duplicate prevention, search, and audit logging.
  - Implemented Lead management backend (`GET /api/leads`, `POST /api/leads`, `GET /api/leads/:id`, `PATCH /api/leads/:id`, `DELETE /api/leads/:id`) with search, multi-field filtering, pagination, and RBAC scoping.
  - Implemented `DuplicateService` for normalized email (`trim().toLowerCase()`) and normalized phone canonical digit comparison (preserving country code).
  - Implemented corporate domain matching (distinguishing relationship warnings from duplicate signals).
  - Implemented explainable suspicious-lead detection (disposable email domains, repeating-digit phones, test placeholder patterns).
  - Implemented Lead Activity tracking (`POST /api/leads/:id/activities`, `GET /api/leads/:id/activities`) supporting 10 activity types with chronological sorting and server-attributed `createdById`.
  - Implemented soft-delete archival for leads (`isArchived = true`) to prevent accidental destruction of historical activities, scores, and deals.
  - Implemented immutable `AuditLog` recording across lead creation, update, archival, reassignment, company creation, and activity logging.
  - Built responsive frontend UI:
    - `LeadsPage.jsx`: Filterable, searchable table with duplicate/suspicious badges, Add Lead modal with live duplicate checking, Edit modal, and Archive modal.
    - `LeadDetailPage.jsx`: Two-column overview with contact info, company info, sales assignment, interactive activity logging form, and visual chronological timeline.
    - `CompaniesPage.jsx`: Searchable directory, Add Company modal, Edit modal, and company details drawer with associated active leads.
  - Built and passed 18 automated backend verification tests (`npm run test:crm`).
  - Verified 0 regressions across auth tests (`npm run test:auth`), database verification (`npm run test:db`), and health probes (`npm run test:health`).
  - Verified client production build (`npm run build:client`) succeeded with 0 errors.

---

### PHASE 5: Sales Pipeline & Deal Management
- **Status**: ✅ **COMPLETED**
- **Deliverables**:
  - Prisma schema extended with `DealStageHistory` model and `closedAt` field on `Deal`, migrated via `20261009050346_add_deal_stage_history_and_closed_at`.
  - Implemented Pipeline Stage APIs: `GET /api/pipeline/stages`, `PUT /api/pipeline/stages/reorder`, `PATCH /api/pipeline/stages/reorder` with atomic order updating preventing unique collisions.
  - Implemented Pipeline Health & Analytics: `GET /api/pipeline/metrics` computing open pipeline value, weighted value factoring probabilities, win rate %, average deal value, and chronological stage velocity.
  - Implemented Deal Management APIs: `GET /api/deals`, `POST /api/deals`, `GET /api/deals/:id`, `PATCH /api/deals/:id`.
  - Implemented Stage Transitions: `PATCH /api/deals/:id/stage` updating stage, transitioning terminal `WON`/`LOST` status with `closedAt` timestamps, logging `DealStageHistory`, and enforcing reopening guards (`403 Forbidden` for Sales Reps).
  - Implemented Lead-to-Deal Conversion: `POST /api/leads/:id/convert` setting lead `status = 'CONVERTED'`, linking company and deal, recording initial stage entry, and creating audit trail (`LEAD_CONVERTED` and `DEAL_CREATED`).
  - Built responsive frontend UI:
    - `PipelinePage.jsx`: Interactive Kanban board with KPI banner, drag-and-drop between stages, deal quick selectors, stage transition note modal, and deal creation modal.
    - `DealsPage.jsx`: Filterable, searchable data table with multi-attribute filtering, pagination, "Create Deal" modal, and comprehensive deal detail drawer featuring full chronological `DealStageHistory` timeline.
    - `LeadDetailPage.jsx`: "Convert to Deal" button and modal connecting active leads to pipeline opportunities.
    - `Sidebar.jsx` & `Navbar.jsx`: Enabled Sales Pipeline (`/pipeline`) and Deals & Revenue (`/deals`) navigation with Phase 5 branding.
  - Built and verified 18 automated pipeline test cases (`npm run test:pipeline`).
  - Verified 0 regressions across all suites (`npm run test:health`, `npm run test:db`, `npm run test:auth`, `npm run test:crm`, `npm run build:client`).

---

### PHASE 6: Lead Intelligence — Scoring, Priority & Automation
- **Status**: ✅ **COMPLETED**
- **Deliverables**:
  - Prisma schema updated adding `breakdown Json?` to `LeadScore` model via migration `20261009061242_add_breakdown_to_lead_score`.
  - Centralized scoring rules configuration (`server/src/config/scoring.config.js`) defining:
    - Activity weights: `DEMO_REQUEST` (+25), `PRICING_PAGE_VIEW` (+10), `EMAIL_REPLY` (+10), `MEETING` (+10), `BROCHURE_DOWNLOAD` (+8), `FORM_SUBMISSION` (+8), `CALL` (+5), `WEBSITE_VISIT` (+2), `EMAIL_OPEN` (+1).
    - Anti-inflation caps per activity type (e.g. `WEBSITE_VISIT` max 10 pts, `EMAIL_OPEN` max 5 pts, `PRICING_PAGE_VIEW` max 30 pts, `DEMO_REQUEST` max 50 pts).
    - Strict score boundaries `[0, 100]`.
    - Engagement classification thresholds: `HOT` (70–100), `WARM` (40–69), `COLD` (0–39).
    - Priority synchronization thresholds: `URGENT` (85–100), `HIGH` (70–84), `MEDIUM` (40–69), `LOW` (0–39).
    - Configured inactivity threshold: 14 days (`STALLED_THRESHOLD_DAYS`).
  - Scoring & Intelligence service (`server/src/services/scoring.service.js`):
    - `calculateScoreFromActivities()`: Deterministic, bounded calculation with contributions, caps, and human-readable explanation bullets.
    - `detectStalledStatus()`: Real database timestamp analysis (last activity date vs now), excluding archived and terminal `CONVERTED`/`LOST` leads.
    - `recalculateLeadScore()`: Idempotent recalculation updating `Lead.score` and `Lead.priority`, creating `LeadScore` snapshots with structured JSON breakdowns, and writing `LEAD_SCORE_CHANGED` audit logs.
    - `getLeadIntelligence()`: Complete explainable intelligence profile retrieval with RBAC enforcement for Sales Reps.
    - `batchRecalculateScores()`: Admin/Manager batch recalculation across active leads with `BATCH_SCORES_RECALCULATED` audit logging.
  - Integration with core CRM:
    - `POST /api/leads/:id/activities` automatically triggers real-time score recalculation and returns updated intelligence.
    - `GET /api/leads` enhanced with `classification` (`HOT`, `WARM`, `COLD`) and `isStalled` (`true`, `false`) query filtering.
  - Dedicated Intelligence Endpoints:
    - `GET /api/leads/:id/intelligence`: Full intelligence profile, score breakdown, stalled status, and recent snapshots.
    - `GET /api/leads/:id/score-history`: Chronological score snapshots with source activity details.
    - `POST /api/leads/:id/recalculate-score`: On-demand single lead recalculation.
    - `POST /api/leads/recalculate-scores`: Role-restricted batch recalculation (Admin & Sales Manager only; 403 for Reps).
  - Responsive Frontend UI:
    - `LeadsPage.jsx`: Engagement temperature badges (`🔥 HOT`, `☀️ WARM`, `❄️ COLD`), stalled status indicator badges (`⏳ Stalled (Xd)`), temperature and stalled query filters, and Admin/Manager "Recalculate Scores" button.
    - `LeadDetailPage.jsx`: Dedicated **Lead Intelligence & Qualification Panel** with score progress gauge, engagement velocity status, synchronized priority badge, stalled alert banner, activity contributions grid with anti-inflation cap badges, key drivers breakdown, score snapshots history, and on-demand recalculate button.
  - Automated Testing & Verification:
    - 80 automated verification tests created and passing in `server/verify-intelligence.js` (`npm run test:intelligence`).
    - 0 regressions across existing suites: `npm run test:health`, `npm run test:db`, `npm run test:auth`, `npm run test:crm`, `npm run test:pipeline`.
    - Clean production client build (`npm run build:client`).

---

### PHASE 7: Next-Best-Action Recommendation Engine
- **Status**: ⏳ **NOT IMPLEMENTED YET**
- **Planned Scope**:
  - Rules and heuristics engine for next-best-action generation.
  - Action trigger triggers: e.g., follow-up after demo, re-engage cold lead, escalate stalled proposal.
  - Recommendation priority queue for sales reps.
  - Rep action feedback loop (Accept, Dismiss, Complete action).

---

### PHASE 8: AI Features & Explanations
- **Status**: ⏳ **NOT IMPLEMENTED YET**
- **Planned Scope**:
  - Server-side integration with OpenAI API (preserving secret key isolation).
  - AI reasoning generator explaining *why* an action or lead score was computed.
  - Context-aware email outreach drafting based on previous lead touchpoints.
  - Natural-language query interface for CRM insights.

---

### PHASE 9: Dashboard, Analytics, Notifications & UI Polish
- **Status**: ⏳ **NOT IMPLEMENTED YET**
- **Planned Scope**:
  - Executive sales dashboard with Recharts visualizations (conversion funnel, revenue trends).
  - Individual rep performance dashboards and daily task checklists.
  - Real-time event notifications (Socket.IO integration).
  - Responsive design polish and keyboard accessibility.

---

### PHASE 10: Testing, Security, Deployment & Documentation
- **Status**: ⏳ **NOT IMPLEMENTED YET**
- **Planned Scope**:
  - Backend unit and integration tests (Jest / Supertest).
  - Frontend component and workflow tests (React Testing Library).
  - Rate limiting, security headers (`helmet`), and CORS hardening.
  - Docker containerization and production deployment guides.
  - Final developer and user documentation.
