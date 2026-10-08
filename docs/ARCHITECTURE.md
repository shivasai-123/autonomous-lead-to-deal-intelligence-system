# System Architecture: Autonomous Lead-to-Deal Intelligence System

## 1. High-Level Architecture Overview

The system uses a clean client-server architecture with strict separation between user interface, API gateway/controllers, business services, database access layer, and future AI/real-time integrations.

```text
┌────────────────────────────────────────────────────────┐
│                   React Frontend (SPA)                 │
│         Vite + Tailwind CSS + React Router + Axios     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST (JSON)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Express.js Backend                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Middlewares (CORS, JSON Parser, Auth, Error)     │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Route Aggregator (/api/health, /api/leads, etc.) │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Controllers (HTTP Validation & Serialization)    │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Services (Business Logic & Intelligence Engines) │  │
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
- **Navigation**: React Router v6 implementing nested routing layouts.
- **HTTP Client**: Axios with centralized request/response interceptors.
- **Component Architecture**: Atomic, composable UI primitives (`Button`, `Card`, `Badge`) separated from page-level views.

### Directory Structure
```text
client/src/
├── assets/           # Static assets, SVG icons, imagery
├── components/       # Composable UI components
│   ├── common/       # General-purpose UI (Button, Card, Badge)
│   └── layout/       # App shell components (Navbar, Sidebar)
├── context/          # React Context providers (AppContext)
├── hooks/            # Custom React hooks (useHealthCheck)
├── layouts/          # Page layout shells (RootLayout)
├── pages/            # Routable pages (HomePage, DashboardPage, NotFoundPage)
├── routes/           # Routing table (AppRoutes.jsx)
├── services/         # API HTTP communication client (api.js)
├── utils/            # Shared constants, helpers
├── App.jsx           # App composition root
├── main.jsx          # DOM entry point
└── index.css         # Tailwind base and global directives
```

---

## 3. Backend Architecture (Server Layer)

### Layered Separation of Concerns
1. **Routes Layer (`routes/`)**: Defines URL patterns and maps HTTP verbs to controller methods. No business logic exists here.
2. **Controllers Layer (`controllers/`)**: Extracts request parameters, headers, and body; invokes relevant services; and formats responses using standardized response helpers.
3. **Services Layer (`services/`)**: Contains pure business logic (lead scoring calculations, next-best-action generation, state transitions). Completely decoupled from Express HTTP objects.
4. **Middlewares Layer (`middlewares/`)**: Centralizes cross-cutting concerns (CORS, error trapping, 404 handling, future JWT verification).
5. **Validators Layer (`validators/`)**: Prepared for incoming request payload validation.
6. **Data Access Layer (`config/prisma.js` & `prisma/`)**: Manages database queries via Prisma ORM.

### Directory Structure
```text
server/
├── prisma/
│   └── schema.prisma        # Prisma data models & datasource config
├── src/
│   ├── config/              # Environment config & Prisma client instance
│   ├── controllers/         # HTTP request/response handlers
│   ├── middlewares/         # Central error handler, not-found handler
│   ├── modules/             # Future self-contained CRM domain modules
│   ├── routes/              # Express route declarations
│   ├── services/            # Core domain & intelligence services
│   ├── utils/               # Structured logger, standardized API responses
│   ├── validators/          # Input validation schemas (Phase 3+)
│   ├── app.js               # Express app bootstrapping and middleware pipeline
│   └── server.js            # HTTP server launch, signal trapping & graceful shutdown
├── .env.example             # Documented environment template
└── package.json
```

---

## 4. Security Architecture & Principles

1. **Zero Secret Exposure**: Third-party API keys (OpenAI) and internal secrets (JWT secrets, database credentials) exist exclusively on the server and are accessed via environment variables.
2. **No Plaintext Passwords**: Password hashing via `bcrypt` (enforced in Phase 3).
3. **Centralized Error Sanitization**: Unhandled exceptions are logged internally via structured logging; client responses hide stack traces in production to prevent information leakage.
4. **CORS Governance**: Express CORS middleware restricts API requests to the configured frontend origin (`CLIENT_URL`).
5. **SQL Injection Prevention**: Prisma ORM uses parameterized queries exclusively for all database interactions.
6. **Role-Based Authorization (RBAC)**: Architecture designed for middleware gates (`requireRole('admin')`, `requireRole('manager')`) across sensitive routes.

---

## 5. Technology Rationale

| Technology | Selection Rationale |
| :--- | :--- |
| **React + Vite** | High performance, rapid developer feedback loop, modern component ecosystem. |
| **Tailwind CSS** | Utility-first styling enabling consistent SaaS design systems without bloated custom CSS files. |
| **Node.js / Express** | Lightweight, event-driven runtime ideal for RESTful I/O, easy integration with Prisma and future Socket.IO streams. |
| **PostgreSQL + Prisma** | Strict relational integrity, foreign key cascades, migration history, type-safe database queries. MongoDB was explicitly rejected to preserve relational consistency across users, leads, deals, and stages. |
| **OpenAI Integration** | Isolated as a backend service client (Phase 8), keeping AI logic transparent, testable, and secure. |
