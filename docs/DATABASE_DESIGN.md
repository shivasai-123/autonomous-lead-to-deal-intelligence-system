# Relational Database Design: Autonomous Lead-to-Deal System

> **Phase 2 Status**: Relational PostgreSQL schema implemented and active via Prisma ORM. Migration `20261008182056_init_crm_models` applied, Prisma Client generated, and foundational seed data loaded.

---

## 1. Database Architecture & Technology Rationale

### Why PostgreSQL?
1. **Strict Relational Integrity & Foreign Keys**: B2B CRM workflows require rigid referential integrity between users, companies, leads, activities, stages, and deals. Foreign key constraints prevent orphaned activities, invalid assignments, and fragmented pipelines.
2. **ACID Compliance**: Multi-entity financial deals, stage transitions, and audit records must be atomically consistent.
3. **Arbitrary-Precision Numerics (`Decimal`)**: Currency amounts on deals require exact precision (`DECIMAL(12, 2)`) to avoid binary floating-point rounding errors.
4. **Rich JSON Support**: Complex activity metadata, score factor breakdowns, and audit diffs are stored efficiently in indexed PostgreSQL JSONB columns without requiring premature denormalization.
5. **Rejection of MongoDB**: Document stores lack enforced cross-document relational consistency, cascade rules, and schema-level referential guarantees essential for enterprise sales systems.

### Why Prisma ORM?
1. **Declarative Schema Modeling**: All models, relations, indexes, and constraints live in a single, version-controlled file ([`server/prisma/schema.prisma`](file:///C:/Users/HP/OneDrive/Desktop/AUTONOMOUS%20LEAD-TO-DEAL%20INTELLIGENCE%20SYSTEM/server/prisma/schema.prisma)).
2. **Type-Safe Database Client**: Auto-generated client methods ensure query type safety, eliminating runtime query typos.
3. **Deterministic Migrations**: `prisma migrate dev` creates transparent, reversible SQL migrations with tracking in the `_prisma_migrations` table.
4. **Declarative Referential Actions**: Native support for `Cascade`, `SetNull`, and `Restrict` policies.

---

## 2. Entity-Relationship Overview & Cardinality

```text
  ┌──────────────┐          ┌──────────────┐
  │     Role     │ 1      * │     User     │
  └──────┬───────┘          └──────┬───────┘
         │                         │ 1 (Assignee / Creator)
         │                         │ *
         │                         ▼
         │                  ┌──────────────┐
         │       ┌─────────►│     Lead     │◄────────┐
         │       │          └──────┬───────┘         │
         │       │                 │ 1               │ 1
         │       │ *               │ *               │
  ┌──────▼───────┴┐         ┌──────▼───────┐  ┌──────┴───────┐
  │    Company    │         │ LeadActivity │  │  LeadScore   │
  └──────┬────────┘         └──────────────┘  └──────────────┘
         │ 1                       │ 1
         │ *                       │ 1 (Source Event)
         ▼                         ▼
  ┌──────────────┐ 1      * ┌──────────────┐
  │PipelineStage │◄─────────┤     Deal     │
  └──────────────┘          └──────┬───────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
  │Recommendation│          │ Notification │          │   AuditLog   │
  └──────────────┘          └──────────────┘          └──────────────┘
```

---

## 3. Implemented Prisma Data Models (Phase 2)

### 3.1 `Role` (`roles`)
Defines role-based access control boundaries.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `name` | `String` | `@unique` | System role name (`ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`) |
| `description`| `String?`| Nullable | Human-readable description of role duties |
| `createdAt` | `DateTime` | `@default(now())` | Record creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Record last-updated timestamp |

- **Relations**: Has many `User` records (`users User[]`).
- **Referential Action**: Deleting a Role is restricted (`onDelete: Restrict`) if users are assigned to it.

---

### 3.2 `User` (`users`)
Represents sales reps, managers, and system administrators.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `firstName` | `String` | Required | First name of the user |
| `lastName` | `String` | Required | Last name of the user |
| `email` | `String` | `@unique` | Corporate email address |
| `passwordHash` | `String` | Required | Password hash placeholder (auth in Phase 3) |
| `roleId` | `String` | Foreign Key | Reference to `Role.id` |
| `isActive` | `Boolean` | `@default(true)` | Active / deactivated account toggle |
| `createdAt` | `DateTime` | `@default(now())` | Registration timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Profile update timestamp |

- **Relations**:
  - `role`: Belongs to `Role` (`onDelete: Restrict`).
  - `assignedLeads`: Has many `Lead` records assigned (`Lead[]`).
  - `createdActivities`: Has many `LeadActivity` records logged (`LeadActivity[]`).
  - `assignedDeals`: Has many `Deal` records owned (`Deal[]`).
  - `assignedRecommendations`: Has many `Recommendation` items (`Recommendation[]`).
  - `notifications`: Has many `Notification` items (`Notification[]`).
  - `auditLogs`: Has many `AuditLog` entries (`AuditLog[]`).
- **Indexes**: `@@index([email])`, `@@index([roleId])`.

---

### 3.3 `Company` (`companies`)
Represents organizations and corporate customer accounts.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `name` | `String` | Required | Legal or business name |
| `industry` | `String?` | Nullable | Sector / vertical (e.g. SaaS, Finance, Healthcare) |
| `website` | `String?` | Nullable | Primary domain URL |
| `phone` | `String?` | Nullable | Switchboard telephone number |
| `email` | `String?` | Nullable | Primary contact email |
| `address` | `String?` | Nullable | Street address |
| `city` | `String?` | Nullable | City location |
| `country` | `String?` | Nullable | Country location |
| `createdAt` | `DateTime` | `@default(now())` | Account creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Account update timestamp |

- **Relations**:
  - `leads`: Has many `Lead` records (`Lead[]`).
  - `deals`: Has many `Deal` records (`Deal[]`).
- **Indexes**: `@@index([name])`.

---

### 3.4 `Lead` (`leads`)
Prospective sales opportunities and inbound contacts.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `firstName` | `String` | Required | First name of the contact |
| `lastName` | `String` | Required | Last name of the contact |
| `email` | `String` | Required | Direct email address |
| `phone` | `String?` | Nullable | Direct phone number |
| `jobTitle` | `String?` | Nullable | Professional designation |
| `source` | `String?` | Nullable | Channel (e.g. `INBOUND_FORM`, `REFERRAL`, `WEB_SEARCH`) |
| `status` | `LeadStatus` | `@default(NEW)` | Lifecycle status (`NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `CONVERTED`, `LOST`) |
| `priority` | `LeadPriority` | `@default(MEDIUM)` | Priority rating (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) |
| `score` | `Int` | `@default(0)` | Current computed qualification score (0–100) |
| `isArchived` | `Boolean` | `@default(false)` | Soft-deletion flag preserving historical dependencies |
| `isDuplicate` | `Boolean` | `@default(false)` | Duplicate detection match flag |
| `isSuspicious` | `Boolean` | `@default(false)` | Explainable data anomaly warning flag |
| `suspiciousReason` | `String?` | Nullable | Detailed explanation for suspicious flag |
| `companyId` | `String?` | Foreign Key | Optional reference to `Company.id` |
| `assignedToId` | `String?` | Foreign Key | Optional reference to assigned `User.id` |
| `createdAt` | `DateTime` | `@default(now())` | Inbound capture timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Modification timestamp |

- **Relations**:
  - `company`: Belongs to `Company` (`onDelete: SetNull`).
  - `assignedTo`: Belongs to `User` (`onDelete: SetNull`).
  - `activities`: Has many `LeadActivity` items (`onDelete: Cascade`).
  - `scoreHistory`: Has many `LeadScore` items (`onDelete: Cascade`).
  - `deals`: Has many converted `Deal` records (`Deal[]`).
  - `recommendations`: Has many `Recommendation` items (`onDelete: Cascade`).
- **Indexes**: `@@index([email])`, `@@index([companyId])`, `@@index([assignedToId])`, `@@index([status])`, `@@index([score])`, `@@index([isArchived])`, `@@index([createdAt])`.

---

### 3.5 `LeadActivity` (`lead_activities`)
Chronological engagement touchpoints and prospect behavioral events.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `type` | `ActivityType` | Required | Event category (see Enums below) |
| `description` | `String?` | Nullable | Human-readable activity narrative |
| `metadata` | `Json?` | Nullable | Arbitrary payload (e.g., page URL, duration, form answers) |
| `occurredAt` | `DateTime` | `@default(now())` | Real-world occurrence time |
| `createdAt` | `DateTime` | `@default(now())` | Database record insertion time |
| `leadId` | `String` | Foreign Key | Parent `Lead.id` |
| `createdById` | `String?` | Foreign Key | Logging `User.id` (nullable for automated web events) |

- **Relations**:
  - `lead`: Belongs to `Lead` (`onDelete: Cascade`).
  - `createdBy`: Belongs to `User` (`onDelete: SetNull`).
  - `triggeredScores`: Back-reference to causal `LeadScore` records (`LeadScore[]`).
- **Indexes**: `@@index([leadId])`, `@@index([occurredAt])`, `@@index([type])`.

---

### 3.6 `LeadScore` (`lead_scores`)
Audit trail of qualification score fluctuations explaining *why* a lead score changed.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `score` | `Int` | Required | Score value snapshot (e.g. 65) |
| `reason` | `String` | Required | Explanatory rationale (e.g. "+25 Demo request submitted") |
| `leadId` | `String` | Foreign Key | Parent `Lead.id` |
| `sourceActivityId` | `String?` | Foreign Key | Triggering `LeadActivity.id` |
| `createdAt` | `DateTime` | `@default(now())` | Score computation timestamp |

- **Relations**:
  - `lead`: Belongs to `Lead` (`onDelete: Cascade`).
  - `sourceActivity`: Belongs to `LeadActivity` (`onDelete: SetNull`).
- **Indexes**: `@@index([leadId])`, `@@index([createdAt])`.

---

### 3.7 `PipelineStage` (`pipeline_stages`)
Configurable, sequential sales pipeline milestones.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `name` | `String` | `@unique` | Stage label (`New`, `Contacted`, `Qualified`, `Demo`, `Proposal`, `Negotiation`, `Won`, `Lost`) |
| `order` | `Int` | `@unique` | Sequential step order (1 through 8) |
| `probability` | `Int` | `@default(0)` | Win conversion probability percentage (0 to 100) |
| `isActive` | `Boolean` | `@default(true)` | Active stage flag |
| `createdAt` | `DateTime` | `@default(now())` | Stage creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Stage modification timestamp |

- **Relations**: Has many `Deal` records (`deals Deal[]`).
- **Referential Action**: Deleting an active stage containing deals is restricted (`onDelete: Restrict`).
- **Indexes**: `@@index([order])`.

---

### 3.8 `Deal` (`deals`)
Commercial opportunities progressing through the pipeline stages.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `title` | `String` | Required | Opportunity title / name |
| `value` | `Decimal` | `@db.Decimal(12, 2)` | Commercial contract value (safe precision) |
| `currency` | `String` | `@default("USD")` | ISO 4217 currency code |
| `expectedCloseDate` | `DateTime?` | Nullable | Target closing date |
| `description` | `String?` | Nullable | Scope and deal notes |
| `status` | `DealStatus`| `@default(OPEN)` | Current deal state (`OPEN`, `WON`, `LOST`) |
| `leadId` | `String?` | Foreign Key | Origin `Lead.id` |
| `companyId` | `String?` | Foreign Key | Associated `Company.id` |
| `assignedToId` | `String?` | Foreign Key | Owner `User.id` |
| `pipelineStageId` | `String` | Foreign Key | Current `PipelineStage.id` |
| `createdAt` | `DateTime` | `@default(now())` | Opportunity creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last modification timestamp |

- **Relations**:
  - `lead`: Belongs to `Lead` (`onDelete: SetNull`).
  - `company`: Belongs to `Company` (`onDelete: SetNull`).
  - `assignedTo`: Belongs to `User` (`onDelete: SetNull`).
  - `pipelineStage`: Belongs to `PipelineStage` (`onDelete: Restrict`).
- **Indexes**: `@@index([leadId])`, `@@index([companyId])`, `@@index([assignedToId])`, `@@index([pipelineStageId])`, `@@index([status])`.

---

### 3.9 `Recommendation` (`recommendations`)
Next-Best-Action guidance surfaced for sales representatives.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `type` | `RecommendationType` | Required | Category (`CONTACT_LEAD`, `SEND_FOLLOW_UP`, `SCHEDULE_DEMO`, `REVIEW_STALLED_LEAD`, `OTHER`) |
| `title` | `String` | Required | Short action directive |
| `explanation` | `String` | Required | Contextual explanation explaining *why* the action was suggested |
| `confidence` | `Float?` | Nullable | Algorithmic confidence score (0.00 to 1.00) |
| `status` | `RecommendationStatus` | `@default(PENDING)` | Current status (`PENDING`, `ACCEPTED`, `DISMISSED`, `EXECUTED`) |
| `leadId` | `String` | Foreign Key | Target `Lead.id` |
| `assignedToId` | `String?` | Foreign Key | Target `User.id` |
| `createdAt` | `DateTime` | `@default(now())` | Recommendation generation timestamp |
| `expiresAt` | `DateTime?` | Nullable | Optional expiration window |

- **Relations**:
  - `lead`: Belongs to `Lead` (`onDelete: Cascade`).
  - `assignedTo`: Belongs to `User` (`onDelete: SetNull`).
- **Indexes**: `@@index([leadId])`, `@@index([assignedToId])`, `@@index([status])`.

---

### 3.10 `Notification` (`notifications`)
Real-time alerts and user event feed items.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `type` | `NotificationType` | Required | Category (`LEAD_ASSIGNED`, `SCORE_THRESHOLD_REACHED`, `RECOMMENDATION_GENERATED`, `DEAL_STAGE_CHANGED`, `SYSTEM_ALERT`) |
| `title` | `String` | Required | Short notification title |
| `message` | `String` | Required | Alert body narrative |
| `isRead` | `Boolean` | `@default(false)` | Read/unread flag |
| `readAt` | `DateTime?` | Nullable | Timestamp when opened |
| `userId` | `String` | Foreign Key | Recipient `User.id` |
| `createdAt` | `DateTime` | `@default(now())` | Creation timestamp |

- **Relations**: Belongs to `User` (`onDelete: Cascade`).
- **Indexes**: `@@index([userId])`, `@@index([userId, isRead])`.

---

### 3.11 `AuditLog` (`audit_logs`)
Immutable system-wide event and compliance ledger.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `@id @default(uuid())` | Unique UUID identifier |
| `action` | `String` | Required | Action verb (`LEAD_CREATED`, `LEAD_ASSIGNED`, `STAGE_CHANGED`, etc.) |
| `entityType` | `String` | Required | Model name (`Lead`, `Deal`, `User`, `Company`) |
| `entityId` | `String` | Required | Primary key of modified entity |
| `metadata` | `Json?` | Nullable | Diff, payload snapshot, or environmental context |
| `userId` | `String?` | Foreign Key | Actor `User.id` (nullable for system-automated events) |
| `createdAt` | `DateTime` | `@default(now())` | Event occurrence timestamp |

- **Relations**: Belongs to `User` (`onDelete: SetNull`).
- **Indexes**: `@@index([userId])`, `@@index([entityType, entityId])`, `@@index([createdAt])`.

---

## 4. Enums Defined in Schema

1. **`LeadStatus`**: `NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `CONVERTED`, `LOST`
2. **`LeadPriority`**: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
3. **`ActivityType`**: `WEBSITE_VISIT`, `PRICING_PAGE_VIEW`, `BROCHURE_DOWNLOAD`, `EMAIL_OPEN`, `EMAIL_REPLY`, `DEMO_REQUEST`, `CALL`, `MEETING`, `FORM_SUBMISSION`, `OTHER`
4. **`DealStatus`**: `OPEN`, `WON`, `LOST`
5. **`RecommendationType`**: `CONTACT_LEAD`, `SEND_FOLLOW_UP`, `SCHEDULE_DEMO`, `REVIEW_STALLED_LEAD`, `OTHER`
6. **`RecommendationStatus`**: `PENDING`, `ACCEPTED`, `DISMISSED`, `EXECUTED`
7. **`NotificationType`**: `LEAD_ASSIGNED`, `SCORE_THRESHOLD_REACHED`, `RECOMMENDATION_GENERATED`, `DEAL_STAGE_CHANGED`, `SYSTEM_ALERT`

---

## 5. Migration and Seed Lifecycle

### Migration Applied
- **Migration ID**: `20261008182056_init_crm_models`
- **Location**: [`server/prisma/migrations/20261008182056_init_crm_models/migration.sql`](file:///C:/Users/HP/OneDrive/Desktop/AUTONOMOUS%20LEAD-TO-DEAL%20INTELLIGENCE%20SYSTEM/server/prisma/migrations/20261008182056_init_crm_models/migration.sql)
- **Tables Created**: 11 application tables (`users`, `roles`, `companies`, `leads`, `lead_activities`, `lead_scores`, `pipeline_stages`, `deals`, `recommendations`, `notifications`, `audit_logs`).

### Seed Process
Seed script located at [`server/prisma/seed.js`](file:///C:/Users/HP/OneDrive/Desktop/AUTONOMOUS%20LEAD-TO-DEAL%20INTELLIGENCE%20SYSTEM/server/prisma/seed.js):
- **Roles Seeded**: `ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`.
- **Pipeline Stages Seeded**:
  1. `New` (10% win probability)
  2. `Contacted` (20% win probability)
  3. `Qualified` (40% win probability)
  4. `Demo` (60% win probability)
  5. `Proposal` (75% win probability)
  6. `Negotiation` (90% win probability)
  7. `Won` (100% win probability)
  8. `Lost` (0% win probability)
- **Development-Only Sample Data**: 1 sample rep user (explicit development placeholder hash), 1 sample company, 1 lead, 1 activity, 1 score history record, 1 deal, 1 recommendation, 1 notification, and 1 audit log to verify relational joins.

---

## 6. Implementation Status Separation

### ✅ Implemented in Phase 2
- Complete Prisma relational schema ([`server/prisma/schema.prisma`](file:///C:/Users/HP/OneDrive/Desktop/AUTONOMOUS%20LEAD-TO-DEAL%20INTELLIGENCE%20SYSTEM/server/prisma/schema.prisma))
- Initial database migration applied to PostgreSQL (`20261008182056_init_crm_models`)
- Prisma Client generation
- Database seed script ([`server/prisma/seed.js`](file:///C:/Users/HP/OneDrive/Desktop/AUTONOMOUS%20LEAD-TO-DEAL%20INTELLIGENCE%20SYSTEM/server/prisma/seed.js))
- Database verification test ([`server/verify-db.js`](file:///C:/Users/HP/OneDrive/Desktop/AUTONOMOUS%20LEAD-TO-DEAL%20INTELLIGENCE%20SYSTEM/server/verify-db.js))

### ⏳ Planned for Future Phases (Not Yet Implemented)
- **Phase 3**: Authentication endpoints, bcrypt password hashing, JWT token verification, RBAC route guards.
- **Phase 4**: Lead CRUD APIs, company management, activity logging routes, deduplication algorithms.
- **Phase 5**: Sales pipeline stage progression logic, deal conversion workflows, kanban views.
- **Phase 6**: Lead scoring engine calculating point values from activities.
- **Phase 7**: Recommendation generation rules and Next-Best-Action heuristics.
- **Phase 8**: OpenAI API integration for natural language recommendation explanations.
- **Phase 9**: Visual analytics dashboards, Recharts components, Socket.IO notification feeds.
- **Phase 10**: Production hardening, Docker containerization, end-to-end testing.
