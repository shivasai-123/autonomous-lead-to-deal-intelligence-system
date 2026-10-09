# System Architecture: Autonomous Lead-to-Deal Intelligence System

## 1. High-Level Architecture Overview

The system uses a clean client-server architecture with strict separation between user interface, API gateway/controllers, business services, database access layer, and future AI/real-time integrations.

```text
┌────────────────────────────────────────────────────────┐
│                   React Frontend (SPA)                 │
│         Vite + Tailwind CSS + React Router + Axios     │
│   (AuthContext + ProtectedRoute + Login/Register UI)   │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST (JSON + Bearer JWT)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Express.js Backend                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Middlewares (CORS, JSON Parser, Auth, RBAC, Error│  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Route Aggregator (/api/auth, /api/users, etc.)   │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Controllers (Auth, User, Health)                 │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Services (AuthService, UserService)              │  │
│  └──────────────────────────┬───────────────────────┘  │
└─────────────────────────────┼──────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
┌──────────────────────────────┐ ┌──────────────────────┐
│          Prisma ORM          │ │ OpenAI API (Phase 8) │
│       PostgreSQL Database    │ │ (Server-side proxy)  │
└──────────────────────────────┘ └──────────────────────┘
```

---

## 2. Frontend Architecture (Client Layer)

### Tech Stack
- **Framework / Bundler**: React 18+ with Vite for ultra-fast HMR and optimized production bundles.
- **Styling**: Tailwind CSS configured with a SaaS color palette (slate neutral with indigo/brand accents).
- **Navigation & Routing**: React Router v6 implementing nested routing layouts, `ProtectedRoute`, and role-based access gates.
- **HTTP Client**: Axios with centralized request/response interceptors automatically attaching Bearer JWT and handling 401 expiration.
- **Authentication State**: `AuthContext` managing active user state, login, registration, logout, and automatic session restoration on page reload.
- **Component Architecture**: Atomic, composable UI primitives (`Button`, `Card`, `Badge`) separated from page-level views.

### Directory Structure
```text
client/src/
├── assets/           # Static assets, SVG icons, imagery
├── components/       # Composable UI components
│   ├── common/       # General-purpose UI (Button, Card, Badge)
│   └── layout/       # App shell components (Navbar, Sidebar)
├── context/          # React Context providers (AppContext, AuthContext)
├── hooks/            # Custom React hooks (useHealthCheck)
├── layouts/          # Page layout shells (RootLayout)
├── pages/            # Routable pages (HomePage, DashboardPage, LoginPage, RegisterPage, UsersPage, LeadsPage, LeadDetailPage, CompaniesPage, NotFoundPage)
├── routes/           # Routing table (AppRoutes.jsx, ProtectedRoute.jsx)
├── services/         # API HTTP communication clients (api.js, auth.js, crm.js)
├── utils/            # Shared constants, helpers
├── App.jsx           # App composition root with AuthProvider
├── main.jsx          # DOM entry point
└── index.css         # Tailwind base and global directives
```

---

## 3. Backend Architecture (Server Layer)

### Layered Separation of Concerns
1. **Routes Layer (`routes/`)**: Defines URL patterns and maps HTTP verbs to controller methods. Protected routes are secured by `requireAuth` and `requireRole`.
2. **Controllers Layer (`controllers/`)**: Extracts request parameters, headers, and body; invokes relevant services; and formats responses using standardized response helpers (`sendSuccess`, `sendError`).
3. **Services Layer (`services/`)**: Contains pure business logic (`AuthService`, `UserService`, `CompanyService`, `LeadService`, `ActivityService`, `DuplicateService`, `AuditService`). Encapsulates password hashing, token issuance, duplicate matching, audit tracking, and Prisma database operations.
4. **Middlewares Layer (`middlewares/`)**: Centralizes cross-cutting concerns:
   - `requireAuth`: Verifies Bearer JWT tokens and attaches authenticated user profiles to `req.user`.
   - `requireRole(...roles)`: Enforces role-based permissions (`ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`).
   - `errorHandler`: Global exception handler sanitizing error responses.
   - `notFoundHandler`: Catches unmapped routes.
5. **Validators Layer (`validators/`)**: Input sanitization and payload validation schemas (`auth.validator.js`, `user.validator.js`, `company.validator.js`, `lead.validator.js`, `activity.validator.js`).
6. **Data Access Layer (`config/prisma.js` & `prisma/`)**: Manages database queries via Prisma ORM connected to PostgreSQL.

### Directory Structure
```text
server/
├── prisma/
│   ├── migrations/          # Version-controlled SQL migrations
│   ├── schema.prisma        # Prisma data models & datasource config
│   └── seed.js              # Seed script (roles, stages, dev accounts)
├── src/
│   ├── config/              # Environment config & Prisma client instance
│   ├── controllers/         # Health, Auth, User, Company, Lead, Activity controllers
│   ├── middlewares/         # Central error handler, notFoundHandler, requireAuth, requireRole
│   ├── modules/             # Reserved for future domain modules
│   ├── routes/              # index.js, health, auth, user, company, lead routes
│   ├── services/            # Auth, User, Company, Lead, Activity, Duplicate, Audit services
│   ├── utils/               # Structured logger, standardized API responses, password & token helpers
│   ├── validators/          # auth, user, company, lead, activity validators
│   ├── app.js               # Express app bootstrapping and middleware pipeline
│   └── server.js            # HTTP server launch, signal trapping & graceful shutdown
├── verify-health.js         # Backend health diagnostic test
├── verify-db.js             # Database model and relational join test
├── verify-auth.js           # 10-test authentication and RBAC suite
├── verify-crm.js            # 18-test CRM Core and Intelligence verification suite
├── .env.example             # Documented environment template
└── package.json
```

---

## 4. Authentication & Security Architecture (Phase 3)

### 4.1 Password Security
- Passwords are never stored in plaintext.
- Hashes are generated via `bcryptjs` with cost factor 12.
- Password hashes are never logged, never sent over the wire, and stripped from all API responses via `formatSafeUser()`.

### 4.2 Token Issuance & Claims
- Authentication uses JSON Web Tokens (JWT) signed with `JWT_SECRET` from `server/.env`.
- Tokens contain minimal claims:
  ```json
  {
    "id": "u-uuid-here",
    "email": "user@company.com",
    "role": "SALES_REPRESENTATIVE"
  }
  ```
- Expiration is configurable via `JWT_EXPIRES_IN` (defaults to `7d`).

### 4.3 Role-Based Access Control (RBAC)
- Roles are verified at both the route middleware level (`requireRole`) and database level:
  - **ADMIN**: Unrestricted access to user directory, status toggling, and role modification. Full read/write access to all companies, leads, and audit entries.
  - **SALES_MANAGER**: Lead and company management oversight; assign leads to sales representatives; archive leads.
  - **SALES_REPRESENTATIVE**: Access scoped to assigned or unassigned leads. Can create leads (auto-assigned to self) and log activities. Cannot access or update another rep's assigned lead. Public registration strictly defaults to `SALES_REPRESENTATIVE`.

### 4.4 Client Session & Token Storage
- Bearer tokens are stored in `localStorage` under `autolead_jwt_token`.
- Centralized token management via `api.js` ensures components never manipulate raw storage directly.
- On 401 Unauthorized responses, Axios interceptor clears stored credentials and fires a global event resetting the UI to logged-out state, avoiding infinite redirect loops.

---

## 5. CRM Core & Intelligence Architecture (Phase 4)

### 5.1 Deduplication & Corporate Domain Correlation
The `DuplicateService` implements a three-tier contact analysis engine:
1. **Normalized Email Matching**: Emails are trimmed and transformed to lowercase. Matches trigger a `409 Conflict` duplicate warning with matching record details.
2. **Normalized Phone Matching**: Phone numbers are converted to canonical digits preserving country code prefix. Formats like `+1 (555) 234-5678` and `15552345678` are accurately identified as matching.
3. **Corporate Domain Matching**: Non-public webmail domains (e.g. `@acme.com`) are extracted. Matching existing leads by corporate domain surfaces an informational organizational relationship warning, rather than an automatic duplicate flag, enabling multiple employees from the same firm to be tracked without false positives.

### 5.2 Explainable Suspicious Contact Detection
Automated rules flag anomalies for human review without black-box ML:
- Disposable/temporary email domains (e.g., Mailinator, TempMail).
- Obvious test email patterns (`test@test.com`, `fake@fake.com`).
- Malformed phone numbers (< 7 digits or repeating digits like `0000000`).
- Test name patterns.
When flagged, `isSuspicious: true` and `suspiciousReason` are persisted in PostgreSQL.

### 5.3 Soft-Delete Archival Pattern
To preserve relational auditability, financial deal links, and activity histories, lead deletion executes soft-delete archival:
- Sets `isArchived: true`.
- Excluded from standard operational listings by default.
- Cascades are prevented, preserving related activities, deals, and scores.

---

## 6. Sales Pipeline & Deal Management Architecture (Phase 5)

### 6.1 Opportunity Lifecycle & Stage Machine
Commercial opportunities flow through ordered stages defined in `PipelineStage`:
1. `New` (10% win probability)
2. `Contacted` (20% win probability)
3. `Qualified` (40% win probability)
4. `Demo` (60% win probability)
5. `Proposal` (75% win probability)
6. `Negotiation` (90% win probability)
7. `Won` (100% win probability) - Terminal stage (`status = WON`, `closedAt = now()`)
8. `Lost` (0% win probability) - Terminal stage (`status = LOST`, `closedAt = now()`)

### 6.2 Atomic Stage Transitions & Velocity Tracking
Every stage movement occurs inside a PostgreSQL `$transaction`:
- The deal's `pipelineStageId`, `status`, and `closedAt` are updated.
- A chronological `DealStageHistory` record is written, storing `dealId`, `fromStageId`, `toStageId`, `userId`, `transitionNote`, and `enteredAt`.
- Audit logs record `DEAL_STAGE_CHANGED`, `DEAL_WON`, or `DEAL_LOST`.
- **Reopening Guard**: Sales Reps are blocked from reverting `WON` or `LOST` deals back to open stages (`403 Forbidden`). Only Sales Managers and Admins can reopen closed deals, resetting `closedAt = null` and `status = 'OPEN'`.

### 6.3 Lead-to-Deal Conversion
When a qualified lead is converted via `POST /api/leads/:id/convert`:
- Lead is validated (must be active and not previously converted).
- Lead `status` is atomically set to `CONVERTED`.
- A commercial `Deal` record is created linking `leadId`, `companyId`, and `assignedToId`.
- An initial `DealStageHistory` entry is written with `fromStageId: null`.
- Synchronous audit log records `LEAD_CONVERTED` and `DEAL_CREATED`.

### 6.4 Pipeline Analytics & Stage Velocity
- `totalOpenPipelineValue`: sum of open deal values.
- `weightedPipelineValue`: sum of `(deal.value * stage.probability / 100)`.
- `winRate`: `(wonCount / (wonCount + lostCount)) * 100`.
- `stageVelocity`: average duration (in days) spent in each stage derived from historical transition records in `DealStageHistory`.

---

## 7. Next-Best-Action Recommendation Engine (Phase 7)
Deterministic, rule-based recommendation matrix prioritizing high-impact sales workflows:
1. `SCHEDULE_DEMO`: Triggered by direct demo requests or hot leads with pricing page interactions.
2. `REVIEW_STALLED_LEAD`: Triggered by leads with no activity for &ge; 14 days.
3. `CONTACT_NEW_LEAD`: Triggered by newly created leads awaiting initial contact.
4. `SEND_FOLLOW_UP`: Triggered by high/medium priority leads inactive for &ge; 3 days.
5. `CONVERT_TO_DEAL`: Triggered by qualified leads with high engagement.

---

## 8. AI Features & Intelligent Sales Assistance (Phase 8)

### 8.1 Architecture & OpenAI SDK Isolation
- **Backend Isolation**: OpenAI integration is strictly isolated in the backend service layer (`AIService`). The frontend never receives API keys or directly communicates with the OpenAI API.
- **Configurable Model & Timeout**: Defaults to `gpt-4o-mini` with a 15-second timeout, configurable via `OPENAI_MODEL` and `OPENAI_TIMEOUT_MS`.
- **Fail-Safe Graceful Fallback**: If `OPENAI_API_KEY` is omitted, the service returns `503 Service Unavailable` with a friendly explanation, guaranteeing zero impact on core CRM functions.
- **Deterministic Mock Provider**: `AIService.setMockProvider(fn)` intercepts completions during automated testing, enabling 100% offline, zero-cost, deterministic CI verification.

### 8.2 Security, Prompt-Injection Defense & Non-Destructive Invariants
- **Prompt Injection Guard**: All CRM data (names, notes, activity descriptions) is passed as untrusted data strings within a strict system-prompt framing boundary (`PROMPT_INJECTION_DEFENSE_HEADER`).
- **Structured JSON Output**: All chat completions enforce `response_format: { type: 'json_object' }` and validate response structure before returning.
- **Token Caps**: Strict token ceilings limit compute costs:
  - Lead Summary: 800 max tokens
  - Follow-Up Draft: 600 max tokens
  - Recommendation Explanation: 500 max tokens
  - Meeting Prep Brief: 900 max tokens
- **Non-Destructive Invariant**: AI is strictly assistive. It cannot modify lead status, alter lead scores, change deal stages, transition recommendation status, or send external communications.
- **Zero Auto-Send Policy**: Outreach drafts are delivered to the frontend as editable drafts only; reps review and copy into their email client.

### 8.3 RBAC & Data Ownership
- Sales Representatives can only generate AI summaries, drafts, explanations, and meeting briefs for leads assigned to them or unassigned leads.
- Access to another representative's lead is rejected with `403 Forbidden`.
- Archived leads are rejected with `400 Bad Request`.
- Sales Managers and Admins maintain organization-wide access.
- Every generation event is auditable via PostgreSQL `AuditLog` (`AI_SUMMARY_GENERATED`, `AI_DRAFT_GENERATED`, `AI_EXPLANATION_GENERATED`, `AI_PREP_GENERATED`).

---

## 9. Executive Analytics, Real-Time Notifications & UI Architecture (Phase 9)

### 9.1 Analytics Engine Architecture
- **Multi-Horizon Calculations**: Supports dynamic date windows (`7d`, `30d`, `90d`, `month`, `all`, custom).
- **Mathematical Invariant Rigor**:
  - `winRate`: Strictly defined as `(wonDeals / (wonDeals + lostDeals)) * 100`. Completely excludes open pipeline deals to avoid artificial dilution. Returns `0%` when denominator is 0.
  - `weightedPipelineValue`: Multiplies active deal contract values by their stage conversion probability percentage (`stage.probability / 100`). Only open opportunities are evaluated.
  - `avgSalesCycleDays`: Computes precise calendar day durations between deal creation (`createdAt`) and successful closure (`closedAt`).
- **5-Stage Conversion Funnel**: Measures attrition across `All Leads` -> `Contacted` -> `Qualified` -> `Deals Created` -> `Deals Won`.
- **Role Scoping**:
  - `ADMIN` & `SALES_MANAGER`: Organization-wide executive analytics and rep performance leaderboard.
  - `SALES_REPRESENTATIVE`: Strictly scoped to assigned or unassigned records; rep performance leaderboard is forbidden (`403 Forbidden`).

### 9.2 Real-Time WebSocket Infrastructure (`Socket.IO`)
- **Connection Handshake**: Authenticated via JWT bearer tokens passed in the socket connection handshake (`auth: { token }`).
- **Private Room Isolation**: Upon verification, each client socket joins room `user:${userId}` exclusively.
- **Zero Broadcast Leak**: System notifications are never broadcast across open channels; messages are emitted strictly to private user rooms via `SocketService.emitToUser(userId, event, payload)`.
- **Deduplication Safeguard**: Automatically suppresses duplicate alert generation within a 60-second window.
- **Resilience**: Client features auto-reconnect backoff alongside a 45-second polling fallback interval.

### 9.3 Notification Center & Frontend Polish
- **Notification Center (`NotificationCenter.jsx`)**: Responsive Navbar bell with real-time animated unread badges, event-specific category icons, relative timestamps ("5m ago", "Yesterday"), mark-as-read, and deep links to related entities.
- **Dual-View Dashboard (`DashboardPage.jsx`)**:
  - Executive Overview: 8 primary KPI cards with time horizon filtering, Recharts 6-month historical revenue AreaChart, Stage Distribution BarChart, 5-stage Conversion Funnel, Acquisition Channel Donut Chart, and Rep Leaderboard.
  - My Workspace: Personal salesperson dashboard with assigned Hot Leads table, Stalled Leads alert panel, Deals Closing Soon, and Pending Next-Best-Actions execution drawer.
- **Deep-Link Query Hydration**: URL search parameter hydration across `LeadsPage.jsx` and `RecommendationsPage.jsx` for seamless click-through from dashboard metrics (e.g. `?classification=HOT`, `?isStalled=true`).

---

## 10. Technology Rationale

| Technology | Selection Rationale |
| :--- | :--- |
| **React + Vite** | High performance, rapid developer feedback loop, modern component ecosystem. |
| **Tailwind CSS** | Utility-first styling enabling consistent SaaS design systems without bloated custom CSS files. |
| **Node.js / Express** | Lightweight, event-driven runtime ideal for RESTful I/O, easy integration with Prisma and Socket.IO. |
| **PostgreSQL + Prisma** | Strict relational integrity, foreign key cascades, migration history, type-safe database queries. |
| **bcryptjs + JWT** | Industry-standard password hashing and stateless authorization tokens with cross-platform stability. |
| **OpenAI SDK (`openai`)** | Isolated backend client with structured JSON parsing, prompt defenses, and injectable mock testing interface. |
| **Socket.IO (`socket.io`)** | Low-latency bi-directional WebSocket streaming with private room multiplexing and HTTP polling fallback. |
| **Recharts (`recharts`)** | Declarative, responsive React charting library with clean svg rendering and custom tooltips. |

