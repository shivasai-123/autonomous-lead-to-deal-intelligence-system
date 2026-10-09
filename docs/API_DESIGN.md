# REST API Conventions & Design: Autonomous Lead-to-Deal CRM

## 1. API Architecture Principles

The API follows RESTful design standards, returning standard JSON payloads, using semantic HTTP verbs, and maintaining predictable URI structures.

- **Base URI**: `/api`
- **Data Format**: `application/json`
- **Authentication**: HTTP `Authorization: Bearer <JWT_TOKEN>` header
- **Versioning**: Implicit URI prefix `/api/...`, with future breaking version bumps isolated via `/api/v2/...` if required.

---

## 2. Standardized Response Formats

### 2.1 Successful Response (`200 OK`, `201 Created`)
Every successful API response contains a boolean `success: true`, a human-readable `message`, and an optional `data` payload:

```json
{
  "success": true,
  "message": "Resource retrieved successfully",
  "data": {
    "id": "cm123abc...",
    "name": "Acme Corp"
  }
}
```

### 2.2 Error Response (`400`, `401`, `403`, `404`, `409`, `422`, `500`)
Every failure response contains `success: false`, a high-level `message`, and an optional `errors` object or array:

```json
{
  "success": false,
  "message": "Validation failed on incoming request",
  "errors": {
    "email": "A valid email address is required"
  }
}
```

---

## 3. HTTP Status Codes

| Code | Meaning | When Used |
| :--- | :--- | :--- |
| **`200 OK`** | Success | Standard read/update operations. |
| **`201 Created`** | Created | Resource created successfully (e.g., user registered). |
| **`400 Bad Request`** | Client Error | Malformed JSON or input validation failure. |
| **`401 Unauthorized`** | Auth Required | Missing, forged, or expired JWT token, or invalid credentials. |
| **`403 Forbidden`** | Access Denied | Authenticated user lacks required role permissions (e.g., Rep accessing user admin). |
| **`404 Not Found`** | Missing Resource | Requested endpoint or database ID does not exist. |
| **`409 Conflict`** | Conflict | Duplicate resource state (e.g., email already registered). |
| **`422 Unprocessable`** | Semantic Error | Valid syntax, but violates business rule. |
| **`500 Internal Error`** | Server Error | Unhandled server error (details masked in production). |

---

## 4. Implemented Endpoints (Phases 1 & 3)

### 4.1 System & Health (Phase 1)
- `GET /api/health`
  - **Auth**: None
  - **Response**: `{ success: true, message: "CRM API is running", data: { status: "healthy", uptimeSeconds, timestamp, environment, version } }`

### 4.2 Authentication (Phase 3)
- `POST /api/auth/register`
  - **Auth**: None (Public)
  - **Body**: `{ "firstName": "Jane", "lastName": "Doe", "email": "rep@example.com", "password": "SecurePassword123!" }`
  - **Rule**: Public registration strictly defaults to role `SALES_REPRESENTATIVE`.
  - **Response (`201 Created`)**: `{ success: true, message: "User registered successfully", data: { user, token } }`

- `POST /api/auth/login`
  - **Auth**: None (Public)
  - **Body**: `{ "email": "rep@example.com", "password": "SecurePassword123!" }`
  - **Response (`200 OK`)**: `{ success: true, message: "Login successful", data: { user, token } }`

- `GET /api/auth/me`
  - **Auth**: `Bearer <token>`
  - **Response (`200 OK`)**: `{ success: true, message: "User profile retrieved", data: { user } }`

- `POST /api/auth/logout`
  - **Auth**: `Bearer <token>`
  - **Response (`200 OK`)**: `{ success: true, message: "Logged out successfully" }`

### 4.3 User Administration (Phase 3)
- `GET /api/users`
  - **Auth**: `Bearer <token>`
  - **Permissions**: `ADMIN`, `SALES_MANAGER`
  - **Query Params**: `?role=SALES_REPRESENTATIVE&search=Jane&page=1&limit=50`
  - **Response (`200 OK`)**: `{ success: true, data: { users: [...], pagination: { total, page, limit, totalPages } } }`

- `GET /api/users/:id`
  - **Auth**: `Bearer <token>`
  - **Permissions**: `ADMIN`, `SALES_MANAGER`
  - **Response (`200 OK`)**: `{ success: true, data: { user: { id, firstName, lastName, email, role, isActive, createdAt } } }`

- `PATCH /api/users/:id/status`
  - **Auth**: `Bearer <token>`
  - **Permissions**: `ADMIN` only
  - **Body**: `{ "isActive": false }`
  - **Rule**: Administrator cannot deactivate their own account.
  - **Response (`200 OK`)**: `{ success: true, message: "User status updated successfully", data: { user } }`

- `PATCH /api/users/:id/role`
  - **Auth**: `Bearer <token>`
  - **Permissions**: `ADMIN` only
  - **Body**: `{ "roleName": "SALES_MANAGER" }`
  - **Rule**: Administrator cannot demote their own account.
  - **Response (`200 OK`)**: `{ success: true, message: "User role updated successfully", data: { user } }`

---

## 5. Phase 4 Implemented Endpoints: CRM Core (Leads, Companies & Activities)

### 5.1 Company Management (`/api/companies`)
- `GET /api/companies`
  - **Auth**: `Bearer <token>` (All roles: `ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE`)
  - **Query**: `?search=&page=1&limit=10&sortBy=createdAt&sortOrder=desc`
  - **Response (`200 OK`)**: `{ success: true, message: "Companies retrieved successfully", data: { companies: [...], pagination: { total, page, limit, totalPages } } }`
- `GET /api/companies/:id`
  - **Auth**: `Bearer <token>` (All roles)
  - **Response (`200 OK`)**: `{ success: true, message: "Company details retrieved successfully", data: { company: { id, name, industry, website, phone, email, address, city, country, leads: [...], deals: [...] } } }`
- `POST /api/companies`
  - **Auth**: `Bearer <token>` (All roles)
  - **Body**: `{ name (required), industry?, website?, phone?, email?, address?, city?, country? }`
  - **Validation & Duplicate Protection**: Enforces case-insensitive company name uniqueness (returns `409 Conflict` if existing name found). Logs `COMPANY_CREATED` audit entry.
  - **Response (`201 Created`)**: `{ success: true, message: "Company created successfully", data: { company } }`
- `PATCH /api/companies/:id`
  - **Auth**: `Bearer <token>` (Roles: `ADMIN`, `SALES_MANAGER`)
  - **Body**: `{ name?, industry?, website?, phone?, email?, address?, city?, country? }`
  - **Audit**: Logs `COMPANY_UPDATED`.
  - **Response (`200 OK`)**: `{ success: true, message: "Company updated successfully", data: { company } }`

### 5.2 Lead Management (`/api/leads`)
- `GET /api/leads`
  - **Auth**: `Bearer <token>`
  - **RBAC Policy**: `SALES_REPRESENTATIVE` sees assigned or unassigned leads; `ADMIN` and `SALES_MANAGER` see all leads.
  - **Query**: `?search=&status=&priority=&companyId=&assignedToId=&isArchived=false&page=1&limit=10&sortBy=createdAt&sortOrder=desc`
  - **Response (`200 OK`)**: `{ success: true, message: "Leads retrieved successfully", data: { leads: [...], pagination } }`
- `GET /api/leads/:id`
  - **Auth**: `Bearer <token>`
  - **RBAC Policy**: Sales reps accessing another rep's assigned lead receive `403 Forbidden`.
  - **Response (`200 OK`)**: `{ success: true, message: "Lead retrieved successfully", data: { lead: { ..., company, assignedTo, activities, scoreHistory, deals, recommendations } } }`
- `POST /api/leads/check-duplicates`
  - **Auth**: `Bearer <token>`
  - **Body**: `{ email?, phone?, excludeLeadId? }`
  - **Response (`200 OK`)**: `{ success: true, message: "Duplicate check completed", data: { isDuplicate, duplicateMatches, domainMatches, reasons } }`
- `POST /api/leads`
  - **Auth**: `Bearer <token>` (All roles; Sales reps auto-assigned unless unassigned)
  - **Body**: `{ firstName, lastName, email, phone?, jobTitle?, source?, status?, priority?, companyId?, assignedToId?, forceCreate? }`
  - **Duplicate & Suspicious Protection**:
    - Normalizes email (`trim().toLowerCase()`) and phone digits.
    - If duplicate found and `forceCreate !== true`: returns `409 Conflict` with matching lead details and reasons.
    - Evaluates suspicious contact rules (disposable email domains, repeating digit phones, placeholder names). Sets `isSuspicious` and `suspiciousReason`.
    - Logs `LEAD_CREATED` audit entry.
  - **Response (`201 Created`)**: `{ success: true, message: "Lead created successfully", data: { lead, duplicateWarning, domainMatches } }`
- `PATCH /api/leads/:id`
  - **Auth**: `Bearer <token>`
  - **RBAC**: Sales reps can update own accessible leads; only `ADMIN` and `SALES_MANAGER` can change `assignedToId`.
  - **Audit**: Logs `LEAD_UPDATED` and `LEAD_ASSIGNMENT_CHANGED`.
  - **Response (`200 OK`)**: `{ success: true, message: "Lead updated successfully", data: { lead } }`
- `DELETE /api/leads/:id`
  - **Auth**: `Bearer <token>` (Roles: `ADMIN`, `SALES_MANAGER`)
  - **Behavior**: Soft-delete archival (`isArchived = true`). Preserves dependent activities, deals, and score histories. Excluded from active queries.
  - **Audit**: Logs `LEAD_ARCHIVED`.
  - **Response (`200 OK`)**: `{ success: true, message: "Lead successfully archived", data: { lead } }`

### 5.3 Lead Activity Tracking (`/api/leads/:id/activities`)
- `GET /api/leads/:id/activities`
  - **Auth**: `Bearer <token>`
  - **Response (`200 OK`)**: `{ success: true, message: "Lead activities retrieved successfully", data: { activities: [...], pagination } }`
- `POST /api/leads/:id/activities`
  - **Auth**: `Bearer <token>`
  - **Body**: `{ type: ActivityType (required), description?, occurredAt?, metadata? }`
  - **Security**: Server attaches authenticated `req.user.id` to `createdById` (client cannot spoof activity creator).
  - **Audit**: Logs `LEAD_ACTIVITY_RECORDED`.
  - **Response (`201 Created`)**: `{ success: true, message: "Lead activity recorded successfully", data: { activity } }`

---

## 6. Phase 5: Sales Pipeline & Deal Management Endpoints

### 6.1 Pipeline Stages & Health (`/api/pipeline`)
- `GET /api/pipeline/stages`
  - **Auth**: `Bearer <token>` (All roles)
  - **Description**: Returns all active pipeline stages ordered by `order asc`, including active deal counts and aggregate value per stage.
  - **Response (`200 OK`)**: `{ success: true, message: "Pipeline stages retrieved successfully", data: { stages: [...] } }`
- `PUT /api/pipeline/stages/reorder` / `PATCH /api/pipeline/stages/reorder`
  - **Auth**: `Bearer <token>` (Roles: `ADMIN`, `SALES_MANAGER`)
  - **Body**: `{ stageOrders: [{ id: "...", order: 1 }, { id: "...", order: 2 }, ...] }`
  - **Behavior**: Atomically updates stage orders inside a PostgreSQL transaction using negative intermediate order offsets to prevent unique constraint collisions.
  - **Audit**: Logs `PIPELINE_ORDER_CHANGED`.
  - **Response (`200 OK`)**: `{ success: true, message: "Pipeline stages reordered successfully", data: { stages: [...] } }`
- `GET /api/pipeline/metrics`
  - **Auth**: `Bearer <token>` (Scoped to assigned deals for Sales Reps; all deals for Managers/Admins)
  - **Description**: Computes real-time sales pipeline health metrics:
    - `totalOpenDeals`: count of open opportunities
    - `totalOpenPipelineValue`: sum of values of open deals
    - `weightedPipelineValue`: sum of `(value * stage.probability / 100)` for open deals
    - `wonDealsCount`: count of won deals
    - `lostDealsCount`: count of lost deals
    - `winRate`: `(wonDeals / (wonDeals + lostDeals)) * 100`
    - `averageDealValue`: average value of active and won opportunities
    - `stageVelocity`: average days spent per stage derived from `DealStageHistory`
  - **Response (`200 OK`)**: `{ success: true, message: "Pipeline metrics calculated successfully", data: { ... } }`

### 6.2 Deals Management (`/api/deals`)
- `GET /api/deals`
  - **Auth**: `Bearer <token>` (Sales reps scoped to assigned or unassigned; Managers/Admins view all)
  - **Query Params**: `search`, `status` (`OPEN`, `WON`, `LOST`), `pipelineStageId`, `companyId`, `assignedToId`, `page`, `limit`, `sortBy`, `sortOrder`
  - **Response (`200 OK`)**: `{ success: true, message: "Deals retrieved successfully", data: { deals: [...], pagination: { total, page, limit, totalPages } } }`
- `POST /api/deals`
  - **Auth**: `Bearer <token>` (All roles; sales reps auto-assign to self if unassigned)
  - **Body**: `{ title: string, value: number, currency?: string, pipelineStageId: string, companyId?: string, assignedToId?: string, expectedCloseDate?: string, description?: string }`
  - **Behavior**: In a transaction, creates `Deal`, creates initial `DealStageHistory` (`fromStageId: null`), sets status (`OPEN`, or `WON`/`LOST` if terminal stage), and logs `DEAL_CREATED` audit log.
  - **Response (`201 Created`)**: `{ success: true, message: "Deal created successfully", data: { deal } }`
- `GET /api/deals/:id`
  - **Auth**: `Bearer <token>` (RBAC scoped: Rep can only view own or unassigned deals)
  - **Description**: Retrieves full deal details with company, lead, assigned user, current stage, and complete chronological `stageHistory` timeline.
  - **Response (`200 OK`)**: `{ success: true, message: "Deal retrieved successfully", data: { deal } }`
- `PATCH /api/deals/:id`
  - **Auth**: `Bearer <token>` (Sales reps can update own deals; only `ADMIN`/`SALES_MANAGER` can reassign `assignedToId`)
  - **Body**: `{ title?, value?, currency?, expectedCloseDate?, description?, companyId?, assignedToId? }`
  - **Audit**: Logs `DEAL_UPDATED`.
  - **Response (`200 OK`)**: `{ success: true, message: "Deal updated successfully", data: { deal } }`
- `PATCH /api/deals/:id/stage`
  - **Auth**: `Bearer <token>` (Sales reps can transition own deals)
  - **Body**: `{ stageId: string, transitionNote?: string }`
  - **Terminal Lifecycle & RBAC Rules**:
    - If target stage is `Won` (100%): sets `status = 'WON'`, sets `closedAt = now()`, logs `DEAL_WON`.
    - If target stage is `Lost` (0%): sets `status = 'LOST'`, sets `closedAt = now()`, logs `DEAL_LOST`.
    - If target stage is open and current deal is closed (`WON` or `LOST`): **Sales Reps are rejected with `403 Forbidden`** ("Only Sales Managers and Admins can reopen closed deals"); Managers/Admins reopen deal, setting `status = 'OPEN'` and `closedAt = null`.
    - Appends entry to `DealStageHistory` recording `fromStageId`, `toStageId`, `userId`, `transitionNote`, and `enteredAt`.
  - **Response (`200 OK`)**: `{ success: true, message: "Deal stage updated successfully", data: { deal } }`
- `POST /api/leads/:id/convert` (also `POST /api/deals/convert`)
  - **Auth**: `Bearer <token>` (Sales reps can convert own/unassigned leads)
  - **Body**: `{ title: string, value: number, currency?: string, pipelineStageId?: string, expectedCloseDate?: string, description?: string }`
  - **Behavior**: In a transaction:
    - Verifies lead is not archived and not already converted (re-converting returns `400 Bad Request`).
    - Updates lead `status = 'CONVERTED'`.
    - Creates `Deal` linked to `lead.id` and associated company.
    - Creates initial `DealStageHistory` entry.
    - Logs `LEAD_CONVERTED` on Lead and `DEAL_CREATED` on Deal.
  - **Response (`201 Created`)**: `{ success: true, message: "Lead successfully converted to deal", data: { deal, lead } }`

---

---

## 7. Implemented Endpoints: Lead Intelligence & Scoring (Phase 6)

### 7.1 Intelligence Profile & Explanation
- `GET /api/leads/:id/intelligence`
  - **Auth**: `Bearer <token>` (RBAC scoped: Rep can only view own or unassigned leads)
  - **Description**: Returns explainable intelligence profile:
    - `leadId`: Target lead ID
    - `score`: Current deterministic engagement score (0–100)
    - `classification`: Temperature rating (`HOT`, `WARM`, `COLD`)
    - `priority`: Synchronized priority (`URGENT`, `HIGH`, `MEDIUM`, `LOW`)
    - `scoreChange`: Delta between latest two score snapshots
    - `isStalled`: Inactivity flag (true if inactive &ge; 14 days and non-terminal)
    - `daysSinceLastActivity`: Elapsed days since latest recorded activity
    - `lastActivityAt`: Timestamp of latest activity
    - `stalledThresholdDays`: Configured threshold (14)
    - `stalledReason`: Human-readable stalled status explanation
    - `summaryText`: Synthesized intelligence rationale
    - `contributions`: Granular array of activity contributions with raw points, weight, capped points, and anti-inflation cap status
    - `reasons`: Bulleted scoring drivers
    - `recentHistory`: Recent `LeadScore` snapshots
  - **Response (`200 OK`)**: `{ success: true, message: "Lead intelligence retrieved successfully", data: { ... } }`

### 7.2 Chronological Score History
- `GET /api/leads/:id/score-history`
  - **Auth**: `Bearer <token>` (RBAC scoped: Rep can only view own or unassigned leads)
  - **Description**: Retrieves full chronological score history snapshots with structured JSON breakdowns and causal `sourceActivity` relation.
  - **Response (`200 OK`)**: `{ success: true, message: "Score history retrieved successfully", data: { history: [...] } }`

### 7.3 On-Demand Single Lead Recalculation
- `POST /api/leads/:id/recalculate-score`
  - **Auth**: `Bearer <token>` (Rep can recalculate own leads; Manager/Admin can recalculate any)
  - **Description**: Idempotently re-evaluates all recorded activities, updates `Lead.score` and `Lead.priority`, persists `LeadScore` snapshot only on actual score change, and records `LEAD_SCORE_CHANGED` audit log.
  - **Response (`200 OK`)**: `{ success: true, message: "Lead score recalculated successfully", data: { ... } }`

### 7.4 Batch Score Recalculation
- `POST /api/leads/recalculate-scores`
  - **Auth**: `Bearer <token>` (Roles: `ADMIN`, `SALES_MANAGER` only; Reps receive `403 Forbidden`)
  - **Description**: Recalculates intelligence profiles across all non-archived leads in database, syncing scores/priorities and recording `BATCH_SCORES_RECALCULATED` audit log.
  - **Response (`200 OK`)**: `{ success: true, message: "Batch lead scores recalculated successfully", data: { totalProcessed, updatedCount, unchangedCount, errorCount, errors } }`

---

## 8. Implemented Endpoints: Next-Best-Action Recommendation Engine (Phase 7)

### 8.1 List Recommendations with Filtering & Metrics
- `GET /api/recommendations`
  - **Auth**: `Bearer <token>` (RBAC scoped: Rep can only view recommendations for assigned or unassigned leads; Admin/Manager view all)
  - **Query Parameters**:
    - `status`: Filter by status (`PENDING`, `ACCEPTED`, `DISMISSED`, `EXECUTED`)
    - `type`: Filter by action type (`SCHEDULE_DEMO`, `REVIEW_STALLED_LEAD`, `CONTACT_LEAD`, `SEND_FOLLOW_UP`, `OTHER`)
    - `search`: Search title, explanation, contact name, or company
    - `page`, `limit`: Pagination parameters (default: page 1, limit 20)
    - `sortBy`, `sortOrder`: Sorting field and direction (default: `createdAt` desc)
  - **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "Recommendations retrieved successfully",
      "data": {
        "data": [
          {
            "id": "uuid",
            "type": "SCHEDULE_DEMO",
            "title": "Schedule Product Demonstration",
            "explanation": "Lead submitted a product demo request...",
            "confidence": 0.95,
            "status": "PENDING",
            "metadata": { "ruleId": "RULE_SCHEDULE_DEMO", "trigger": "DEMO_REQUEST", "leadScore": 75 },
            "createdAt": "2026-10-09T...",
            "lead": { "id": "...", "firstName": "...", "lastName": "...", "company": { "name": "..." } },
            "assignedTo": { "id": "...", "firstName": "..." }
          }
        ],
        "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
        "metrics": {
          "totalPending": 1,
          "totalAccepted": 0,
          "totalExecuted": 0,
          "totalDismissed": 0,
          "highConfidenceCount": 1
        }
      }
    }
    ```

### 8.2 Get Single Recommendation Detail
- `GET /api/recommendations/:id`
  - **Auth**: `Bearer <token>` (RBAC verification enforced)
  - **Response (`200 OK`)**: `{ success: true, message: "Recommendation retrieved successfully", data: { recommendation: { ... } } }`

### 8.3 Transition Recommendation Status
- `PATCH /api/recommendations/:id/status`
  - **Auth**: `Bearer <token>`
  - **Body**: `{ "status": "ACCEPTED" | "DISMISSED" | "EXECUTED", "reason": "Optional transition reason" }`
  - **Description**: Validates state machine rules (`PENDING` -> `ACCEPTED`/`DISMISSED`, `ACCEPTED` -> `EXECUTED`/`DISMISSED`), updates metadata history, and records audit logs (`RECOMMENDATION_ACCEPTED`, `RECOMMENDATION_DISMISSED`, `RECOMMENDATION_EXECUTED`).
  - **Response (`200 OK`)**: `{ success: true, message: "Recommendation marked as ACCEPTED", data: { recommendation: { ... } } }`

### 8.4 Batch Recalculate Recommendations
- `POST /api/recommendations/batch-refresh`
  - **Auth**: `Bearer <token>` (Roles: `ADMIN`, `SALES_MANAGER` only; Reps receive `403 Forbidden`)
  - **Description**: Re-evaluates Next-Best-Action recommendations across all active, non-archived leads in the CRM and logs `BATCH_RECOMMENDATIONS_REFRESHED`.
  - **Response (`200 OK`)**: `{ success: true, message: "Batch recommendation evaluation completed across X leads.", data: { totalProcessed, generatedCount, reusedCount, errorsCount } }`

### 8.5 Lead-Specific Recommendations
- `GET /api/leads/:id/recommendations`
  - **Auth**: `Bearer <token>` (RBAC scoped)
  - **Description**: Lists all active and historical recommendations for a specific lead.
  - **Response (`200 OK`)**: `{ success: true, message: "Lead recommendations retrieved successfully", data: { recommendations: [...] } }`

- `POST /api/leads/:id/recommendations/generate`
  - **Auth**: `Bearer <token>` (Rep can generate for assigned lead; Manager/Admin for any)
  - **Description**: Force re-evaluates recommendation for specific lead on demand.
  - **Response (`200 OK`)**: `{ success: true, message: "Lead recommendation evaluated successfully", data: { leadId, recommendation, action } }`

---

---

## 9. Implemented Endpoints: AI Features & Intelligent Sales Assistance (Phase 8)

### 9.1 AI Configuration Options
- `GET /api/ai/options`
  - **Auth**: `Bearer <token>` (All authenticated users)
  - **Description**: Returns supported tones, outreach objectives, and meeting types for UI dropdowns.
  - **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "AI options retrieved successfully",
      "data": {
        "tones": [{ "id": "PROFESSIONAL", "label": "Professional & Consultative" }, ...],
        "objectives": [{ "id": "REQUEST_MEETING", "label": "Request introductory discovery meeting" }, ...],
        "meetingTypes": [{ "id": "INITIAL_DISCOVERY", "label": "Initial Discovery Call" }, ...]
      }
    }
    ```

### 9.2 Grounded Executive Lead Summary
- `POST /api/ai/leads/:id/summary`
  - **Auth**: `Bearer <token>` (Sales Reps scoped to assigned/unassigned leads; Managers & Admins view all)
  - **Description**: Synthesizes factual executive briefing grounded strictly in verified CRM records (company, timeline, score velocity, open deals). Fails with `400 Bad Request` on archived leads.
  - **Audit**: Logs `AI_SUMMARY_GENERATED` with actor and model metadata.
  - **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "AI lead summary generated successfully",
      "data": {
        "summary": {
          "overview": "string",
          "notableEngagement": "string",
          "salesPosition": "string",
          "concernsOrGaps": "string",
          "suggestedFocus": "string",
          "leadId": "uuid",
          "generatedAt": "ISO timestamp"
        }
      }
    }
    ```

### 9.3 Personalized Follow-Up Email Draft
- `POST /api/ai/leads/:id/follow-up-draft`
  - **Auth**: `Bearer <token>` (RBAC scoped)
  - **Body**:
    ```json
    {
      "tone": "PROFESSIONAL",
      "objective": "REQUEST_MEETING",
      "additionalContext": "string (optional, max 500 chars)"
    }
    ```
  - **Behavior**: Generates editable email draft. Strictly adheres to zero auto-send policy; no external communications or emails are dispatched automatically.
  - **Audit**: Logs `AI_DRAFT_GENERATED`.
  - **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "AI follow-up draft generated successfully",
      "data": {
        "draft": {
          "subject": "string",
          "body": "string",
          "channel": "EMAIL",
          "tone": "PROFESSIONAL",
          "objective": "REQUEST_MEETING",
          "leadId": "uuid",
          "generatedAt": "ISO timestamp"
        }
      }
    }
    ```

### 9.4 Natural-Language Recommendation Explanation
- `POST /api/ai/recommendations/:id/explanation`
  - **Auth**: `Bearer <token>` (RBAC scoped: Reps restricted to assigned recommendations)
  - **Behavior**: Enhances recommendation with natural-language context while preserving underlying deterministic rule facts (`originalExplanation`). Does not alter recommendation status or confidence.
  - **Audit**: Logs `AI_EXPLANATION_GENERATED`.
  - **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "AI recommendation explanation generated successfully",
      "data": {
        "explanation": {
          "recommendationId": "uuid",
          "type": "RECOMMENDATION_TYPE",
          "originalExplanation": "string (preserved source of truth)",
          "aiExplanation": "string",
          "actionRationale": "string",
          "suggestedPreparation": "string",
          "generatedAt": "ISO timestamp"
        }
      }
    }
    ```

### 9.5 Meeting & Discovery Call Preparation Brief
- `POST /api/ai/leads/:id/meeting-preparation`
  - **Auth**: `Bearer <token>` (RBAC scoped)
  - **Body**:
    ```json
    {
      "meetingType": "INITIAL_DISCOVERY",
      "notes": "string (optional, max 500 chars)"
    }
    ```
  - **Description**: Generates executive preparation brief with high-value discovery questions, verified interests, and pre-call checklist.
  - **Audit**: Logs `AI_PREP_GENERATED`.
  - **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "message": "AI meeting preparation brief generated successfully",
      "data": {
        "prep": {
          "prospectBrief": "string",
          "keyInterests": ["string"],
          "discoveryQuestions": ["string"],
          "potentialConcerns": ["string"],
          "dealContext": "string",
          "checklist": ["string"],
          "meetingType": "INITIAL_DISCOVERY",
          "leadId": "uuid",
          "generatedAt": "ISO timestamp"
        }
      }
    }
    ```

---

## 10. Future Endpoint Blueprint (Phase 9+)

| Module | Method & Endpoint | Description | Phase | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Pipeline & Deals** | `GET /api/pipeline/stages`, `POST /api/deals` | Full sales pipeline & opportunities | Phase 5 | **COMPLETED** |
| **Intelligence** | `GET /api/leads/:id/intelligence`, `POST /api/leads/recalculate-scores` | Explainable scoring, temperature & stalled detection | Phase 6 | **COMPLETED** |
| **NBA Engine** | `GET /api/recommendations`, `PATCH /api/recommendations/:id/status` | Next-best-action recommendation engine | Phase 7 | **COMPLETED** |
| **AI Assistant** | `POST /api/ai/leads/:id/summary`, `POST /api/ai/leads/:id/follow-up-draft` | Grounded AI summaries, email drafts & meeting prep | Phase 8 | **COMPLETED** |
| **Analytics** | `GET /api/analytics/funnel` | Retrieve pipeline conversion metrics | Phase 9 | Planned |
| **Notifications**| `GET /api/notifications` | Fetch user alert notifications | Phase 9 | Planned |

