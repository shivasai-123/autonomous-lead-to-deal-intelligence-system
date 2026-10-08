# High-Level Database Design: Autonomous Lead-to-Deal System

> **Note on Phase 1 Scope**: This document outlines the conceptual data architecture and relational model. Complete Prisma schemas, migrations, indices, and seed scripts will be implemented during **PHASE 2**.

---

## 1. High-Level Entity Relationship Overview

The system models a B2B sales intelligence workflow where incoming interactions aggregate into scored leads, which in turn convert into pipeline-tracked deals.

```text
  ┌──────────────┐          ┌──────────────┐
  │     Role     │ 1      * │     User     │
  └──────┬───────┘          └──────┬───────┘
         │                         │ 1
         │                         │ * (Assigned / Owner)
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
         │ *                       │ 1 (Converted)
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

## 2. Core Entities and Relationships

### 1. User
- **Purpose**: Represents platform users (Sales Reps, Sales Managers, System Admins).
- **Key Attributes**: `id`, `email`, `passwordHash`, `firstName`, `lastName`, `roleId`, `isActive`, `createdAt`, `updatedAt`.
- **Relationships**:
  - Belongs to one `Role`.
  - Can be assigned to multiple `Lead` records.
  - Can own multiple `Deal` records.
  - Author of multiple `LeadActivity` entries.

### 2. Role
- **Purpose**: Defines RBAC permission boundaries (`ADMIN`, `SALES_MANAGER`, `SALES_REP`).
- **Key Attributes**: `id`, `name`, `description`, `permissions` (JSON/Enum).
- **Relationships**: One role has many `User` records.

### 3. Company
- **Purpose**: Represents the organization or enterprise account associated with leads and deals.
- **Key Attributes**: `id`, `name`, `domain`, `industry`, `size`, `annualRevenue`, `website`, `country`, `createdAt`.
- **Relationships**:
  - Has many `Lead` records.
  - Has many `Deal` records.

### 4. Lead
- **Purpose**: Represents an inbound prospect or qualification opportunity prior to conversion into a deal.
- **Key Attributes**: `id`, `companyId`, `assignedUserId`, `firstName`, `lastName`, `email`, `phone`, `jobTitle`, `status` (`NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `CONVERTED`), `source`, `tier` (`HOT`, `WARM`, `COLD`), `isDuplicate`, `isSuspicious`, `createdAt`, `updatedAt`.
- **Relationships**:
  - Belongs optionally to a `Company`.
  - Assigned to a `User` (Sales Rep).
  - Has many `LeadActivity` records.
  - Has one or more historical `LeadScore` snapshots.
  - Can convert into one `Deal`.

### 5. LeadActivity
- **Purpose**: Chronological log of interactions and engagement events (calls, emails, demo meetings, page views, whitepaper downloads).
- **Key Attributes**: `id`, `leadId`, `userId`, `type` (`CALL`, `EMAIL`, `MEETING`, `WEB_VISIT`, `NOTE`), `summary`, `metadata` (JSON), `occurredAt`, `createdAt`.
- **Relationships**:
  - Belongs to a `Lead`.
  - Optionally belongs to the logging `User`.

### 6. LeadScore
- **Purpose**: Stores historical and current engagement scores calculated by the intelligence engine.
- **Key Attributes**: `id`, `leadId`, `scoreValue` (0–100), `tier` (`HOT`, `WARM`, `COLD`), `factors` (JSON breakdown of demographic, behavioral, and decay inputs), `calculatedAt`.
- **Relationships**: Belongs to a `Lead`.

### 7. Deal
- **Purpose**: Represents a qualified sales opportunity being actively worked through the sales pipeline.
- **Key Attributes**: `id`, `leadId` (origin), `companyId`, `ownerUserId`, `stageId`, `name`, `amount`, `currency`, `probabilityPercentage`, `status` (`OPEN`, `WON`, `LOST`), `expectedCloseDate`, `closedAt`, `winLossReason`.
- **Relationships**:
  - Converted from a `Lead`.
  - Belongs to a `Company`.
  - Owned by a `User`.
  - Associated with a current `PipelineStage`.
  - Has many `Recommendation` items.

### 8. PipelineStage
- **Purpose**: Defines sequential milestones in the sales pipeline with default win probabilities and stall thresholds.
- **Key Attributes**: `id`, `name` (`DISCOVERY`, `DEMO_COMPLETED`, `PROPOSAL_SENT`, `NEGOTIATION`, `CLOSED_WON`, `CLOSED_LOST`), `orderIndex`, `probabilityWeight`, `stallThresholdDays`.
- **Relationships**: Has many `Deal` records.

### 9. Recommendation (Next-Best-Action Engine)
- **Purpose**: Actionable recommendations generated for sales reps to accelerate lead progression or deal closing.
- **Key Attributes**: `id`, `leadId` / `dealId`, `targetUserId`, `actionType` (`CALL_LEAD`, `SEND_FOLLOWUP_EMAIL`, `SCHEDULE_DEMO`, `REVISE_PROPOSAL`), `title`, `description`, `reasoning` (Deterministic + AI explanation), `status` (`PENDING`, `ACCEPTED`, `DISMISSED`, `EXECUTED`), `generatedAt`.
- **Relationships**:
  - Associated with a `Lead` or `Deal`.
  - Assigned to a `User`.

### 10. Notification
- **Purpose**: Real-time user alert feed for critical sales events (e.g., Hot Lead spike, stalled deal alert, assigned deal).
- **Key Attributes**: `id`, `userId`, `title`, `message`, `type` (`LEAD_ALERT`, `DEAL_STALLED`, `SYSTEM`), `isRead`, `createdAt`.
- **Relationships**: Belongs to a `User`.

### 11. AuditLog
- **Purpose**: Immutable security audit trail recording critical entity state modifications, scoring overrides, and privilege actions.
- **Key Attributes**: `id`, `userId`, `action` (`CREATE`, `UPDATE`, `DELETE`, `CONVERT`), `entityType` (`LEAD`, `DEAL`, `USER`), `entityId`, `changes` (JSON before/after diff), `ipAddress`, `createdAt`.
- **Relationships**: Belongs to a `User` (actor).

---

## 3. Data Integrity & Migration Strategy (Phase 2 Preview)

- **Foreign Key Constraints**: Standard cascading rules (e.g., deleting a test lead cascades related activities and scores, while deals preserve audit traces).
- **Indexing Targets**: Unique indices on `User.email` and `Lead.email`; compound indices on `[leadId, occurredAt]` for activity chronologies; index on `[status, tier]` for high-speed dashboard queries.
- **Prisma Migrations**: Managed exclusively via declarative `prisma/schema.prisma` files and versioned SQL migration scripts (`prisma migrate dev`).
