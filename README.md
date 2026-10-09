# Autonomous Lead-to-Deal Intelligence System

> **A production-style SaaS CRM platform for sales teams with autonomous qualification, predictive lead scoring, next-best-action recommendations, and pipeline acceleration.**

---

## 🎯 Project Overview

Traditional CRMs are static databases requiring endless manual data entry and guesswork. The **Autonomous Lead-to-Deal Intelligence System** transforms sales management into an autonomous, proactive workflow:
- **Secures multi-user access** with bcrypt password hashing and JWT role-based access control (`ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`).
- **Tracks lead interactions** across web, email, calls, and meetings.
- **Calculates dynamic lead scores** and classifies prospects into Hot, Warm, and Cold tiers.
- **Detects stalled deals, duplicate entries, and anomalous signals**.
- **Recommends the Next-Best-Action (NBA)** for sales representatives with transparent explanations.
- **Progresses qualified leads through the sales pipeline** into won deals.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Axios, Lucide Icons |
| **Backend** | Node.js, Express.js (Modular REST API), Structured Logging |
| **Authentication** | bcryptjs (Cost 12), JSON Web Tokens (JWT), Role-Based Authorization |
| **Database** | PostgreSQL 18.6, Prisma ORM 5.22.0 (Relational schema, migrations, seed data) |
| **AI Services** | OpenAI SDK (`openai` ^7.31.0), `gpt-4o-mini`, Structured JSON completions, Mock provider |
| **Tooling** | npm Workspaces, dotenv, Concurrently |
| **Future (Phases 9, 10)** | Socket.IO, Recharts, Docker |

---

## 📂 Repository Structure

```text
AUTONOMOUS LEAD-TO-DEAL INTELLIGENCE SYSTEM/
│
├── client/                      # React Frontend (Vite + Tailwind CSS)
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── ai/              # AiAssistantPanel, AiExplanationModal
│   │   │   ├── common/          # Reusable UI (Button, Card, Badge)
│   │   │   └── layout/          # Layout UI (Navbar, Sidebar)
│   │   ├── context/             # AppContext, AuthContext
│   │   ├── hooks/               # useHealthCheck hook
│   │   ├── layouts/             # RootLayout
│   │   ├── pages/               # HomePage, DashboardPage, LoginPage, RegisterPage, UsersPage, LeadsPage, LeadDetailPage, CompaniesPage, PipelinePage, DealsPage, RecommendationsPage, NotFoundPage
│   │   ├── routes/              # AppRoutes, ProtectedRoute
│   │   ├── services/            # Axios API client (api.js), Auth client (auth.js), CRM client (crm.js)
│   │   ├── utils/               # Constants
│   │   ├── App.jsx              # App root
│   │   ├── index.css            # Tailwind directives
│   │   └── main.jsx             # DOM entry point
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                      # Express Backend REST API
│   ├── prisma/
│   │   ├── migrations/          # Versioned PostgreSQL SQL migrations
│   │   ├── schema.prisma        # Prisma relational models & datasource config
│   │   └── seed.js              # Database seed script (roles, stages, dev accounts)
│   ├── src/
│   │   ├── config/              # Environment config, Prisma client, scoring, recommendation & AI configs
│   │   ├── controllers/         # Health, Auth, User, Company, Lead, Activity, Pipeline, Deal, Recommendation, AI controllers
│   │   ├── middlewares/         # Central error handler, notFoundHandler, requireAuth, requireRole
│   │   ├── routes/              # index.js, health, auth, user, company, lead, pipeline, deal, recommendation, ai routes
│   │   ├── services/            # Health, Auth, User, Company, Lead, Activity, Duplicate, Pipeline, Deal, Scoring, Recommendation, AI, Audit services
│   │   ├── utils/               # Structured logger, standardized API responses, password & token helpers
│   │   ├── validators/          # auth, user, company, lead, activity, pipeline, deal, recommendation, ai validators
│   │   ├── app.js               # Express app instance & middleware stack
│   │   └── server.js            # HTTP server launch & graceful shutdown
│   ├── verify-health.js         # Automated health diagnostic check
│   ├── verify-db.js             # Automated database relational verification
│   ├── verify-auth.js           # Automated authentication & RBAC verification
│   ├── verify-crm.js            # Automated CRM core & duplicate detection verification
│   ├── verify-pipeline.js       # Automated sales pipeline & deal management verification
│   ├── verify-intelligence.js   # Automated lead intelligence & scoring verification
│   ├── verify-recommendation.js # Automated Next-Best-Action recommendation verification
│   ├── verify-ai.js             # Automated AI features, summaries & sales assistance verification
│   ├── .env.example
│   └── package.json
│
├── docs/                        # Architecture & Engineering Specifications
│   ├── PROJECT_SPEC.md          # Full product & functional spec
│   ├── ARCHITECTURE.md          # System & application architecture
│   ├── DATABASE_DESIGN.md       # Relational models, fields, delete rules & indexes
│   ├── API_DESIGN.md            # REST API conventions & endpoints
│   └── ROADMAP.md               # 10-Phase roadmap (Phases 1-8 completed)
│
├── .gitignore                   # Git ignore rules
├── .env.example                 # Root environment template
├── package.json                 # Monorepo workspaces & concurrent scripts
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14+ (v18.6 active locally on port 5432)
- **npm**: v9.0.0 or higher

### 1. Installation

Install all dependencies across the monorepo workspaces:

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment files for both the server and client:

```bash
# In the root or server directory:
cp server/.env.example server/.env

# In the client directory:
cp client/.env.example client/.env
```

Ensure `server/.env` contains your PostgreSQL `DATABASE_URL`, `JWT_SECRET`, and optional `OPENAI_API_KEY`.

### 3. Database Migration & Seeding

```bash
# Apply migrations to PostgreSQL
npm run prisma:migrate --workspace=server

# Seed system roles, pipeline stages, and development test accounts
npm run db:seed --workspace=server
```

### 4. Running the Development Servers

Launch both backend and frontend concurrently:

```bash
npm run dev
```

Or run each service individually in separate terminals:

```bash
# Terminal 1 - Express Backend API (Port 5000)
npm run dev:server

# Terminal 2 - React Frontend (Port 5173)
npm run dev:client
```

---

## 🧪 Automated Verification Suites

```bash
# 1. Verify backend health check endpoint (/api/health)
npm run test:health

# 2. Verify all 11 database models, relations, seed stages, and decimal handling
npm run test:db

# 3. Verify all 10 authentication, password hashing, JWT, and RBAC tests
npm run test:auth

# 4. Verify all 18 CRM core endpoints, duplicate detection, and activity tracking
npm run test:crm

# 5. Verify all 18 sales pipeline, deal transition, conversion, and velocity tests
npm run test:pipeline

# 6. Verify all 80 lead intelligence, scoring, priority, and stalled detection tests
npm run test:intelligence

# 7. Verify all 82 Next-Best-Action recommendation and rule matrix tests
npm run test:recommendation

# 8. Verify all 73 AI features, lead summaries, follow-up drafts & meeting prep tests
npm run test:ai

# 9. Verify client production build
npm run build:client
```

### Development Test Accounts (Seeded for local testing only)
- **Administrator**: `dev.admin@example.com` / `DevPassword123!`
- **Sales Manager**: `dev.manager@example.com` / `DevPassword123!`
- **Sales Representative**: `dev.rep@example.com` / `DevPassword123!`

---

## 🗺️ Roadmap & Current Status

This repository is currently at **PHASE 8: AI Features, Lead Summaries & Intelligent Sales Assistance (COMPLETED)**.

For detailed scope breakdowns of all 10 planned phases, refer to [`docs/ROADMAP.md`](./docs/ROADMAP.md).
