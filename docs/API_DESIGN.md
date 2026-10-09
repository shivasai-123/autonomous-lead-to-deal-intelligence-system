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

## 5. Future Endpoint Blueprint (Phase 4+)

| Module | Method & Endpoint | Description | Phase |
| :--- | :--- | :--- | :--- |
| **Companies** | `GET /api/companies` | List all tracked companies | Phase 4 |
| **Companies** | `POST /api/companies` | Create new company record | Phase 4 |
| **Leads** | `GET /api/leads` | Paginated lead list with score & tier | Phase 4 |
| **Leads** | `POST /api/leads` | Create new lead with deduplication check | Phase 4 |
| **Leads** | `GET /api/leads/:id` | Retrieve lead details and activity history | Phase 4 |
| **Activities** | `POST /api/leads/:id/activities` | Log touchpoint (call, email, demo) | Phase 4 |
| **Pipeline** | `GET /api/pipeline/stages` | List configured pipeline stages | Phase 5 |
| **Deals** | `POST /api/deals` | Convert qualified lead to deal | Phase 5 |
| **Deals** | `PATCH /api/deals/:id/stage` | Advance deal pipeline stage | Phase 5 |
| **Intelligence** | `POST /api/leads/:id/score` | Trigger deterministic score recalculation | Phase 6 |
| **NBA Engine** | `GET /api/leads/:id/recommendations` | Get next-best-action recommendations | Phase 7 |
| **AI Assistant** | `POST /api/ai/explain` | Generate AI explanation for recommendation | Phase 8 |
| **AI Assistant** | `POST /api/ai/draft-email` | Generate personalized context-aware outreach | Phase 8 |
| **Analytics** | `GET /api/analytics/funnel` | Retrieve pipeline conversion metrics | Phase 9 |
| **Notifications**| `GET /api/notifications` | Fetch user alert notifications | Phase 9 |
