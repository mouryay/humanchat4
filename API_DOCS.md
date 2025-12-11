# HumanChat API Documentation

For the authoritative schema import `openapi.yaml` into Postman, Stoplight, or Swagger UI. This document summarizes each surface with auth, payloads, and rate limits.

## Authentication
- **User auth**: JWT via `Authorization: Bearer <token>` header. Obtain via `/api/auth/login` or `/api/auth/magic-link`.
- **Admin endpoints**: Require JWT with `role` claim `admin` or `manager`.
- **Webhook secrets**: Stripe → `/api/payments/webhook` signed with `STRIPE_WEBHOOK_SECRET`.

## Common Headers
- `Content-Type: application/json`
- `X-Request-Id`: optional client-generated id for tracing.

## Error Format
```json
{
  "error": {
    "code": "resource_not_found",
    "message": "Conversation not found",
    "details": {}
  }
}
```

## Rate Limits
- Authenticated users: 60 requests/min per IP + user id.
- Anonymous endpoints (login, magic link): 10 req/min/IP.
- Admin endpoints: 30 req/min.
- WebSocket connections: 1 concurrent per browser tab.

## Endpoints

### Conversations
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/conversations` | List conversations (paged, sorted by `lastActivity`). |
| GET | `/api/conversations/:id` | Fetch single conversation + participants. |
| GET | `/api/conversations/:id/messages?cursor=` | Paginated messages. |
| POST | `/api/conversations/:id/messages` | Send a message (text, attachments, Sam action). |
| POST | `/api/conversations` | Start a new human conversation. |
| POST | `/api/conversations/connect` | Initiate instant connection. Returns session (paid) or invite (free). |
| POST | `/api/conversations/invites/:inviteId/accept` | Host accepts an instant invite → session spins up. |
| POST | `/api/conversations/invites/:inviteId/decline` | Host declines pending invite. |
| POST | `/api/conversations/invites/:inviteId/cancel` | Requester cancels pending invite. |

#### Example: Send Message
```http
POST /api/conversations/conv-1/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Hey River, can we reschedule?",
  "type": "user_text"
}
```
Response:
```json
{
  "messageId": 123,
  "timestamp": 1731709200000
}
```

### Chat Requests
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/requests` | Send a request to an online human. Rejects if they are offline or already in a session. |
| GET | `/api/requests` | Inbox for the authenticated host — includes pending and recently handled requests. |
| PATCH | `/api/requests/:id/status` | Target (or admin) updates a request to `approved` or `declined`. Approvals provision/return the conversation immediately. |

Behavior notes:
- Requesters can only target other users; the API blocks self-requests and busy/offline hosts.
- The target (or an admin) is the only party allowed to approve/decline.
- When `status` becomes `approved`, the response contains the hydrated conversation so the client can create the local thread right away.

#### Example: Approve a request
```http
PATCH /api/requests/req_123/status
Authorization: Bearer <token>
Content-Type: application/json

{ "status": "approved" }
```
Response:
```json
{
  "request": {
    "id": "req_123",
    "requester_user_id": "user_a",
    "target_user_id": "user_b",
    "status": "approved"
  },
  "conversation": {
    "id": "conv_789",
    "type": "human",
    "participants": ["user_a", "user_b"],
    "participant_display_map": {
      "user_a": "Casey",
      "user_b": "River"
    },
    "last_activity": "2024-05-31T19:12:04.000Z"
  }
}
```

Clients should upsert the conversation (if provided) and then open it so both sides land directly in the chat thread.

### Sessions & Booking
| Method | Path | Description |
| POST | `/api/sessions` | Create scheduled session (booking). |
| GET | `/api/sessions/:id` | Retrieve session metadata. |
| PATCH | `/api/sessions/:id` | Update status (`pending`, `in_progress`, `complete`). |
| GET | `/api/availability/:userId` | Fetch a member's availability slots (CalendarSlotPicker). |

Booking request sample:
```json
{
  "hostUserId": "member-9",
  "startTime": "2025-11-10T18:00:00Z",
  "durationMinutes": 30,
  "price": 220,
  "conversationId": "conv-1"
}
```

### Payments
| Method | Path | Description |
| POST | `/api/payments/donation` | Create donation checkout session. |
| POST | `/api/payments/session` | Create/capture service payment. |
| POST | `/api/payments/webhook` | Stripe webhook endpoint. |

### Sam Concierge
| Method | Path | Description |
| POST | `/api/sam` | Send user context, returns Gemini-crafted response + actions. |
| POST | `/api/sam/actions` | Confirm an action (e.g., connect, booking). |

Payload fields: `message`, `conversationHistory`, `userContext` (timezone, booking, etc.).

### Admin APIs (`/api/admin/*`)
- `GET /api/admin/metrics` – high-level stats (active sessions, revenue, donations).
- `GET /api/admin/users` – list/search users, filter by role.
- `PATCH /api/admin/users/:id` – change role, managed flags.
- `GET /api/admin/requests` – pending managed requests + requested people.
- `POST /api/admin/announcements` – broadcast announcements.

### Notifications & WebSockets
- HTTP: `GET /api/notifications` returns digest.
- WS: connect to `wss://ws.humanchat.com?token=<JWT>` and subscribe to:
  - `status:userId`
  - `conversation:conversationId`
  - `sessions:userId`
- Instant invite events stream on `wss://ws.humanchat.com/notifications/:userId` (server broadcasts `type="instant_invite"` payloads for pending/accepted/etc.).

Messages follow `{ type: "conversation.updated", payload: { ... } }` pattern.

## Pagination & Filtering
- Standard query params: `?cursor=<opaque>&limit=20`.
- Filters for `/api/conversations`: `type=sam|human`, `unread=true`.
- Sorting defaults to `lastActivity desc`.

## Versioning
- Current version: `v1` (implicit). Breaking changes documented in CHANGELOG and communicated via API announcements.

## Tooling
- Import `openapi.yaml` in Swagger UI: `npx swagger-ui-watcher openapi.yaml`.
- Postman collection generated via `npx openapi-to-postmanv2 -s openapi.yaml -o postman.json`.
