# Autonomous Lead-to-Deal Intelligence System

> **A production-style SaaS CRM platform for sales teams with autonomous qualification, predictive lead scoring, next-best-action recommendations, and pipeline acceleration.**  
> *Based on the CRM-02 Challenge Concept (Aczen Finathon).*

---

## 🎯 Project Overview

Traditional CRMs are static databases requiring endless manual data entry and guesswork. The **Autonomous Lead-to-Deal Intelligence System** transforms sales management into an autonomous, proactive workflow:
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
| **Database** | PostgreSQL, Prisma ORM (Foundation configured; schema in Phase 2) |
| **Tooling** | npm Workspaces, dotenv, Concurrently |
| **Future (Phases 3, 8, 9)** | JWT, bcrypt, Socket.IO, OpenAI API, Recharts |

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
│   │   │   ├── common/          # Reusable UI (Button, Card, Badge)
│   │   │   └── layout/          # Layout UI (Navbar, Sidebar)
│   │   ├── context/             # AppContext
│   │   ├── hooks/               # useHealthCheck hook
│   │   ├── layouts/             # RootLayout
│   │   ├── pages/               # HomePage, DashboardPage, NotFoundPage
│   │   ├── routes/              # AppRoutes
│   │   ├── services/            # Axios API client (api.js)
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
│   │   └── schema.prisma        # Prisma datasource & client setup
│   ├── src/
│   │   ├── config/              # Environment config & Prisma client
│   │   ├── controllers/         # HealthController
│   │   ├── middlewares/         # Central error & 404 handlers
│   │   ├── modules/             # Reserved for future domain modules
│   │   ├── routes/              # Health & index router
│   │   ├── services/            # HealthService
│   │   ├── utils/               # Structured logger, standardized API responses
│   │   ├── validators/          # Input validation schemas (Phase 3+)
│   │   ├── app.js               # Express app instance & middleware stack
│   │   └── server.js            # HTTP server launch & graceful shutdown
│   ├── .env.example
│   └── package.json
│
├── docs/                        # Architecture & Engineering Specifications
│   ├── PROJECT_SPEC.md          # Full product & functional spec
│   ├── ARCHITECTURE.md          # System & application architecture
│   ├── DATABASE_DESIGN.md       # High-level entity & relation model
│   ├── API_DESIGN.md            # REST API conventions & endpoints
│   └── ROADMAP.md               # 10-Phase roadmap (Phase 1 completed)
│
├── .gitignore                   # Git ignore rules
├── .env.example                 # Root environment template
├── package.json                 # Monorepo workspaces & concurrent scripts
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (v24.x tested)
- **npm**: v9.0.0 or higher (v11.x tested)

### 1. Installation

Install all dependencies across the monorepo workspaces with a single command from the root directory:

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

Default configuration runs the server on `http://localhost:5000` and the client on `http://localhost:5173`.

### 3. Running the Development Servers

You can launch both the backend and frontend concurrently from the root directory:

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

## 🔍 Verification & Health Check

### Backend Health Check
When the server is running, query the health diagnostic endpoint:

```bash
curl http://localhost:5000/api/health
```

Expected JSON response:
```json
{
  "success": true,
  "message": "CRM API is running",
  "data": {
    "status": "healthy",
    "uptimeSeconds": 12,
    "timestamp": "2026-10-08T16:30:00.000Z",
    "environment": "development",
    "version": "1.0.0"
  }
}
```

### Frontend Client
Navigate to [http://localhost:5173](http://localhost:5173) in your browser:
- **Overview Page (`/`)**: Displays platform pillars, architecture foundation, and quick start links.
- **System Dashboard (`/dashboard`)**: Performs a live probe to `/api/health` displaying real-time server connectivity, status, uptime, and the Phase roadmap.

---

## 🗺️ Roadmap & Current Status

This repository is currently at **PHASE 1: Planning, Architecture & Foundation Setup (COMPLETED)**.

For detailed scope breakdowns of all 10 planned phases, refer to [`docs/ROADMAP.md`](./docs/ROADMAP.md).
