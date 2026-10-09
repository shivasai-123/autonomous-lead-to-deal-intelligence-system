# Autonomous Lead-to-Deal Intelligence System

> **A production-style SaaS CRM platform for modern sales teams featuring autonomous lead qualification, predictive lead scoring, next-best-action recommendations, pipeline acceleration, executive sales analytics, and contextual AI assistance.**

---

## 🎯 Project Overview

Traditional CRMs are static databases requiring endless manual data entry and subjective guesswork. The **Autonomous Lead-to-Deal Intelligence System** transforms sales operations into an intelligent, proactive engine:
- **Secures multi-user access** with bcrypt password hashing and JWT role-based access control (`ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`).
- **Manages core CRM records** including leads, associated companies, and cross-channel activity timelines.
- **Calculates explainable, deterministic lead scores** and automatically classifies prospects into Hot, Warm, and Cold tiers.
- **Identifies stalled leads, duplicate submissions, and anomalous signals** with automated flags.
- **Recommends Next-Best-Actions (NBA)** for sales representatives backed by transparent decision criteria.
- **Drives visual deal management** with interactive Kanban stages, win/loss analytics, and stage duration tracking.
- **Delivers executive dashboards & real-time notifications** powered by Socket.IO WebSockets and high-density KPI aggregations.
- **Assists sales reps with contextual AI** to synthesize lead briefs, generate personalized follow-up drafts, and prepare for prospect calls.

---

## ✨ Main Features

1. **Authentication & Role-Based Access Control (RBAC)**
   - Strict role hierarchy (`ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`).
   - Secure password hashing using `bcryptjs` (salt cost factor 12).
   - Stateless JWT tokens with protected Express middlewares and React route guards.
   - User administration module with role modification and account deactivation for managers/admins.

2. **Core CRM: Leads, Companies & Activity Tracking**
   - Full CRUD for leads and companies with rich metadata (industry, employees, website).
   - Automated duplicate detection scanning normalized email, phone, and company domain combinations.
   - Suspicious lead detection flagging disposable email domains, spam patterns, and test names.
   - Lead activity timeline recording calls, meetings, emails, and website events with metadata.

3. **Sales Pipeline & Deal Management**
   - Visual Kanban pipeline board with drag/select stage transitions.
   - Formal lead-to-deal conversion workflow transferring company and contact relationships.
   - Deal stage velocity tracking via `DealStageHistory` capturing dwell time across stages.
   - Win/loss outcome recording with structured reason tracking.

4. **Explainable Lead Scoring & Intelligence Engine**
   - Deterministic 0–100 scoring algorithm evaluating profile completeness, activity recency, frequency, and company attributes.
   - Categorization into `HOT` ($\ge 70$), `WARM` ($40$–$69$), and `COLD` ($< 40$).
   - Dynamic priority assignment (`URGENT`, `HIGH`, `MEDIUM`, `LOW`).
   - Automated stalled lead detection flagging records inactive for $\ge 14$ days with negative score penalties.
   - Transparent score breakdowns displaying positive points, penalties, and audit trails.

5. **Next-Best-Action (NBA) Recommendation Engine**
   - Heuristic recommendation engine generating context-driven next steps (`CONTACT_LEAD`, `SEND_FOLLOW_UP`, `SCHEDULE_DEMO`, `REVIEW_STALLED_LEAD`).
   - Transparent rationale strings explaining precisely why each action was generated.
   - Lifecycle tracking (`PENDING`, `ACCEPTED`, `DISMISSED`, `EXECUTED`).

6. **Contextual AI Sales Assistant**
   - Synthesizes multi-paragraph lead summaries from activities, scores, and profile signals.
   - Generates personalized follow-up email drafts tailored by tone and context.
   - Explains recommendations in natural conversational language.
   - Prepares call and meeting briefings including prospect pain points and suggested discussion topics.
   - Safe prompt construction with strict sanitization and graceful fallback heuristics when an OpenAI API key is not configured.

7. **Executive Dashboard & Sales Analytics**
   - Multi-horizon date filtering (`7d`, `30d`, `90d`, `month`, `all`, custom).
   - 8 Core KPI metric cards (Active Leads, Hot Leads, Open Deals, Open Pipeline Value, Weighted Pipeline Value, Win Rate %, Avg Deal Size, Avg Sales Cycle).
   - Interactive SVG visualizations via `recharts` (Conversion Funnel, Revenue Trends AreaChart, Stage Distribution Donut, Lead Sources).
   - Sales Rep Workspace tailored specifically for individual salespeople (assigned hot leads, stalled leads, closing deals).
   - Team leaderboard for managers and administrators.

8. **Real-Time Notification Center**
   - Event-driven alerts persisted to PostgreSQL on key business milestones (`LEAD_ASSIGNED`, `SCORE_THRESHOLD_REACHED`, `RECOMMENDATION_GENERATED`, `DEAL_STAGE_CHANGED`, `SYSTEM_ALERT`).
   - Authenticated WebSocket communication via `Socket.IO` with strict user room isolation (`user:${userId}`).
   - In-app notification center with unread badge counter, single/bulk mark-as-read, and deep links to relevant CRM records.
   - Automatic 60-second deduplication suppression preventing alert spam.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite 5, Tailwind CSS 3, Recharts 3, React Router v6, Axios, Socket.IO Client, Lucide Icons |
| **Backend** | Node.js (ES Modules), Express.js (REST API), Socket.IO (Authenticated WebSockets), Structured Logger |
| **Authentication** | bcryptjs (Cost 12), JSON Web Tokens (JWT), Role-Based Authorization Middlewares |
| **Database & ORM** | PostgreSQL 18.6 (Relational models, cascade rules, indexes), Prisma ORM 5.22.0 |
| **AI Integration** | OpenAI SDK (`openai` ^7.31.0), `gpt-4o-mini`, Structured JSON completions, Heuristic Fallback Provider |
| **Repository Tooling**| npm Workspaces, dotenv, Concurrently |

---

## 🏗️ System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                       React Frontend                        │
│   (Vite + Tailwind CSS + Recharts + React Router + Axios)   │
└──────────────┬──────────────────────────────▲───────────────┘
               │ HTTP Requests (JWT)          │ WebSockets
               │ REST Endpoints               │ (Socket.IO user rooms)
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│                    Express.js Backend                       │
│  ├── Auth & RBAC Middleware Stack                           │
│  ├── REST Controllers & Input Validators                    │
│  ├── Domain Services:                                       │
│  │   ├── Lead, Company & Activity Services                  │
│  │   ├── Pipeline & Deal Services                           │
│  │   ├── Scoring & Stalled Detection Engine                 │
│  │   ├── Next-Best-Action (NBA) Rule Engine                 │
│  │   ├── AI Sales Assistant & Prompt Sanitizer              │
│  │   ├── Analytics & Funnel Aggregator                      │
│  │   └── Notification & Socket.IO Dispatcher                │
└──────────────────────────────┬──────────────────────────────┘
                               │ Prisma ORM 5.22.0
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL 18.6 Database                 │
│  ├── Users, Roles & Audit Logs                              │
│  ├── Companies, Leads & Lead Activities                     │
│  ├── Lead Scores & NBA Recommendations                      │
│  ├── Deals, Pipeline Stages & Deal Stage History            │
│  └── Notifications                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Repository Structure

```text
AUTONOMOUS LEAD-TO-DEAL INTELLIGENCE SYSTEM/
│
├── client/                      # React Frontend (Vite + Tailwind CSS + Recharts)
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── ai/              # AiAssistantPanel, AiExplanationModal
│   │   │   ├── common/          # Button, Card, Badge, Modal, Input
│   │   │   ├── layout/          # Navbar, Sidebar, PageHeader
│   │   │   └── notifications/   # NotificationCenter (Bell, badge, real-time drawer)
│   │   ├── context/             # AuthContext, AppContext
│   │   ├── hooks/               # useHealthCheck hook
│   │   ├── layouts/             # RootLayout
│   │   ├── pages/               # DashboardPage, LoginPage, RegisterPage, UsersPage,
│   │   │                        # LeadsPage, LeadDetailPage, CompaniesPage, PipelinePage,
│   │   │                        # DealsPage, RecommendationsPage, NotFoundPage
│   │   ├── routes/              # AppRoutes, ProtectedRoute
│   │   ├── services/            # api.js, auth.js, crm.js, socket.js
│   │   ├── utils/               # Constants & formatters
│   │   ├── App.jsx              # Application root
│   │   ├── index.css            # Tailwind CSS directives
│   │   └── main.jsx             # DOM entry point
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                      # Express Backend REST API & Real-Time Server
│   ├── prisma/
│   │   ├── migrations/          # Versioned PostgreSQL migrations
│   │   ├── schema.prisma        # Prisma relational models, indexes & relations
│   │   └── seed.js              # Database seed script (roles, stages, dev accounts)
│   ├── src/
│   │   ├── config/              # Environment config, Prisma client, scoring & AI configs
│   │   ├── controllers/         # REST API route controllers
│   │   ├── middlewares/         # Central error handler, requireAuth, requireRole
│   │   ├── routes/              # Express API route modules
│   │   ├── services/            # Business logic, rule engines & notification dispatch
│   │   ├── utils/               # Structured logger, response formatters, token helpers
│   │   ├── validators/          # Input validation schemas
│   │   ├── app.js               # Express application configuration
│   │   └── server.js            # HTTP server & Socket.IO server initialization
│   ├── verify-health.js         # Automated health diagnostic check
│   ├── verify-db.js             # Automated database relational verification
│   ├── verify-auth.js           # Automated authentication & RBAC verification
│   ├── verify-crm.js            # Automated CRM core & duplicate detection verification
│   ├── verify-pipeline.js       # Automated sales pipeline & deal management verification
│   ├── verify-intelligence.js   # Automated lead intelligence & scoring verification
│   ├── verify-recommendation.js # Automated Next-Best-Action recommendation verification
│   ├── verify-ai.js             # Automated AI features & prompt safety verification
│   ├── verify-analytics.js      # Automated Executive Dashboard & Notification verification
│   ├── .env.example
│   └── package.json
│
├── docs/                        # Architecture & Engineering Specifications
│   ├── PROJECT_SPEC.md          # Full product and functional specification
│   ├── ARCHITECTURE.md          # End-to-end system and application architecture
│   ├── DATABASE_DESIGN.md       # Relational models, fields, delete rules & indexes
│   ├── API_DESIGN.md            # REST API conventions and endpoint documentation
│   └── ROADMAP.md               # 10-Phase roadmap (Phases 1–9 completed)
│
├── .gitignore                   # Git ignore rules (Secrets, artifacts & node_modules)
├── .env.example                 # Root environment template
├── package.json                 # Monorepo workspaces & concurrent scripts
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **PostgreSQL**: v14.0 or higher running locally or via Docker
- **npm**: v9.0.0 or higher

---

### 1. Installation

Clone the repository and install all dependencies across monorepo workspaces:

```bash
npm install
```

---

### 2. Configure PostgreSQL

Ensure your PostgreSQL service is active. Create a dedicated database for the CRM:

```bash
# Using PostgreSQL CLI (psql):
psql -U postgres -c "CREATE DATABASE autonomous_crm;"
```

*Alternatively, create `autonomous_crm` using pgAdmin or your preferred database administration tool.*

---

### 3. Environment Variable Setup

The repository provides `.env.example` templates with safe default placeholders. Copy them to initialize your local environment:

```bash
# 1. Root configuration (optional reference template)
cp .env.example .env

# 2. Server configuration
cp server/.env.example server/.env

# 3. Client configuration
cp client/.env.example client/.env
```

#### Required Server Environment Variables (`server/.env`):
```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# PostgreSQL Connection String
DATABASE_URL=postgresql://<YOUR_POSTGRES_USER>:<YOUR_POSTGRES_PASSWORD>@localhost:5432/autonomous_crm?schema=public

# Security / Authentication
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d

# Optional AI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=15000
```

#### Client Environment Variables (`client/.env`):
```ini
VITE_API_BASE_URL=http://localhost:5000/api
```

---

### 4. Database Migrations & Seeding

Apply all versioned Prisma migrations to create tables, constraints, and indexes, then seed initial roles, pipeline stages, and development test accounts:

```bash
# Apply migrations to PostgreSQL
npm run prisma:migrate --workspace=server

# Seed system roles, default pipeline stages, and test users
npm run db:seed --workspace=server
```

---

### 5. Running the Application

Launch both the Express backend API and the Vite React frontend concurrently:

```bash
npm run dev
```

The application will be accessible at:
- **Frontend Application**: `http://localhost:5173`
- **Backend REST API**: `http://localhost:5000/api`
- **Health Endpoint**: `http://localhost:5000/api/health`

*To run backend and frontend in separate terminal windows:*
```bash
# Terminal 1 - Express Backend
npm run dev:server

# Terminal 2 - Vite Frontend
npm run dev:client
```

---

## 🤖 AI Configuration & Missing-Key Behavior

The system includes a contextual AI assistant designed for sales operations (`server/src/services/ai.service.js`).

### AI Configuration:
- When an `OPENAI_API_KEY` is provided in `server/.env`, the system connects to the official OpenAI API using `gpt-4o-mini` with structured JSON responses, temperature controls, and prompt sanitization.

### Graceful Missing-Key / Fallback Behavior:
- **No API Key Required**: An OpenAI API key is **not** required to run the application, verify core CRM features, or execute tests.
- When `OPENAI_API_KEY` is absent, undefined, or set to placeholder text, the system automatically engages an intelligent **Heuristic Fallback Provider**.
- The fallback provider synthesizes authentic, deterministic summaries, personalized follow-up drafts, and call prep briefs directly from CRM database records (activities, scores, priority, contact details) without making external network calls.
- The system will **never throw uncaught 500 errors** or crash when the key is omitted.

---

## 🔒 Security Considerations

The application adheres to defensive software engineering practices:
1. **Password Security**: All user passwords are encrypted using `bcryptjs` with a work factor of 12 prior to database storage. Plaintext passwords are never logged or stored.
2. **Stateless JWT Authentication**: Tokens are cryptographically signed with `JWT_SECRET`, carry expiration windows, and are verified on every protected request.
3. **Role-Based Authorization (RBAC)**: All sensitive routes enforce role requirements (`ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`). Sensitive operations (e.g., viewing team leaderboards or modifying user accounts) return `403 Forbidden` for unauthorized roles.
4. **SQL Injection Prevention**: All database interactions use Prisma ORM's parameterized queries, preventing SQL injection vulnerabilities.
5. **WebSocket Room Isolation**: Socket.IO connections verify JWT tokens during handshake. Sockets join private rooms strictly named `user:${userId}`. Broadcast emissions are forbidden to prevent sensitive lead/deal data leaks across users.
6. **Input Validation**: All incoming requests pass through schema validators (`server/src/validators/`) to reject malformed payloads before business logic execution.
7. **Secret Hygiene**: Real `.env` files, credentials, and API keys are strictly excluded from version control via `.gitignore`. The repository contains only sanitized `.env.example` templates.

---

## 🧪 Automated Verification Test Suites

The codebase includes end-to-end automated verification scripts covering every phase of development:

```bash
# 1. Health & Server Diagnostic Check
npm run test:health

# 2. Database Models, Relations, Enums & Seed Integrity
npm run test:db

# 3. Authentication, Password Hashing, JWT & RBAC Authorization
npm run test:auth

# 4. CRM Core (Leads, Companies, Activities, Deduplication, Suspicious Flags)
npm run test:crm

# 5. Sales Pipeline, Deal Transitions, Kanban & Velocity
npm run test:pipeline

# 6. Lead Intelligence, 0-100 Scoring & Stalled Detection Engine
npm run test:intelligence

# 7. Next-Best-Action (NBA) Rule Engine & Decision Matrix
npm run test:recommendation

# 8. AI Sales Features, Summaries, Follow-Ups & Prompt Safety
npm run test:ai

# 9. Executive Dashboard, Analytics Endpoints & Real-Time Socket.IO
npm run test:analytics

# 10. Frontend Production Bundle Build
npm run build:client
```

### Pre-Seeded Development Test Accounts (For Local Development Only)
These accounts are seeded via `npm run db:seed` for immediate local verification:
| Role | Email | Password |
| :--- | :--- | :--- |
| **Administrator** | `dev.admin@example.com` | `DevPassword123!` |
| **Sales Manager** | `dev.manager@example.com` | `DevPassword123!` |
| **Sales Representative** | `dev.rep@example.com` | `DevPassword123!` |

---

## 🗺️ Roadmap & Current Status

| Phase | Description | Status |
| :---: | :--- | :---: |
| **1** | Architecture & Project Foundation | ✅ COMPLETED |
| **2** | PostgreSQL Relational Database & Prisma Setup | ✅ COMPLETED |
| **3** | Authentication, JWT, RBAC & User Management | ✅ COMPLETED |
| **4** | CRM Core: Leads, Companies, Activities & Deduplication | ✅ COMPLETED |
| **5** | Sales Pipeline, Deals, Kanban Board & Conversion | ✅ COMPLETED |
| **6** | Lead Intelligence, 0–100 Scoring & Stalled Detection | ✅ COMPLETED |
| **7** | Next-Best-Action (NBA) Recommendation Engine | ✅ COMPLETED |
| **8** | AI Features, Lead Summaries & Sales Assistance | ✅ COMPLETED |
| **9** | Executive Dashboard, Analytics & Real-Time Notifications | ✅ COMPLETED |
| **10**| Docker Containerization, CI/CD & Production Readiness | 📋 PLANNED |

*For complete implementation details and architectural specifications, consult the documents in the [`docs/`](./docs/) directory.*
