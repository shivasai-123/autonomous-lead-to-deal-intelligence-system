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

## 6. Technology Rationale

| Technology | Selection Rationale |
| :--- | :--- |
| **React + Vite** | High performance, rapid developer feedback loop, modern component ecosystem. |
| **Tailwind CSS** | Utility-first styling enabling consistent SaaS design systems without bloated custom CSS files. |
| **Node.js / Express** | Lightweight, event-driven runtime ideal for RESTful I/O, easy integration with Prisma and future Socket.IO streams. |
| **PostgreSQL + Prisma** | Strict relational integrity, foreign key cascades, migration history, type-safe database queries. |
| **bcryptjs + JWT** | Industry-standard password hashing and stateless authorization tokens with cross-platform stability. |
| **OpenAI Integration** | Isolated as a backend service client (Phase 8), keeping AI logic transparent, testable, and secure. |
