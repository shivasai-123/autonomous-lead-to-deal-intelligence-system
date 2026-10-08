# REST API Conventions & Design: Autonomous Lead-to-Deal CRM

## 1. API Architecture Principles

The API follows RESTful design standards, returning standard JSON payloads, using semantic HTTP verbs, and maintaining predictable URI structures.

- **Base URI**: `/api`
- **Data Format**: `application/json`
- **Authentication**: HTTP `Authorization: Bearer <JWT_TOKEN>` header (starting in Phase 3)
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

### 2.2 Error Response (`400`, `401`, `403`, `404`, `422`, `500`)
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
| **`201 Created`** | Created | Resource created successfully (e.g. lead created, activity logged). |
| **`400 Bad Request`** | Client Error | Malformed JSON or invalid syntax. |
| **`401 Unauthorized`** | Auth Required | Missing or expired JWT token. |
| **`403 Forbidden`** | Access Denied | Insufficient role permissions (e.g., Rep accessing Admin logs). |
| **`404 Not Found`** | Missing Resource | Requested endpoint or database ID does not exist. |
| **`422 Unprocessable`** | Semantic Error | Valid syntax, but violates business rule (e.g., duplicate email). |
| **`500 Internal Error`** | Server Error | Unhandled server error (details masked in production). |

---

## 4. Operational Endpoints (Phase 1)

### `GET /api/health`
Validates that the Express backend service is active and responsive.

- **Request**: `GET /api/health`
- **Headers**: None required
- **Response**:
  ```json
  {
    "success": true,
    "message": "CRM API is running",
    "data": {
      "status": "healthy",
      "uptimeSeconds": 142,
      "timestamp": "2026-10-08T16:30:00.000Z",
      "environment": "development",
      "version": "1.0.0"
    }
  }
  ```

---

## 5. Future Endpoint Blueprint (Phase 3+)

| Module | Method & Endpoint | Description | Phase |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST /api/auth/register` | Register new platform user | Phase 3 |
| **Auth** | `POST /api/auth/login` | Authenticate user & issue JWT | Phase 3 |
| **Auth** | `GET /api/auth/me` | Fetch authenticated user profile | Phase 3 |
| **Users** | `GET /api/users` | List tenant users (Admin/Manager) | Phase 3 |
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
