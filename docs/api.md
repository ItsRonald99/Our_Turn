# API

All resources are scoped by house. Base URL in development: `http://localhost:3001` (frontend proxies `/api` to this).

Responses use `{ data }` on success and `{ error: "message" }` on failure.

## Authentication

All endpoints except `/auth/*` and `/health` require a valid JWT access token in the `Authorization: Bearer <token>` header.

The access token is a JWT with a 15-minute TTL. A refresh token (httpOnly cookie) can be used to silently renew it.

### Auth endpoints

- **POST /auth/register** — Create a new account.  
  Body: `{ email, password (min 8 chars), displayName }`  
  Returns: `{ data: { user, accessToken } }` + sets `refreshToken` httpOnly cookie.  
  Errors: `400` (validation), `409` (email already registered)

- **POST /auth/login** — Authenticate with email and password.  
  Body: `{ email, password }`  
  Returns: `{ data: { user, accessToken } }` + sets `refreshToken` httpOnly cookie.  
  Errors: `400` (missing fields), `401` (invalid credentials)

- **POST /auth/logout** — Invalidate refresh token and clear cookie. Returns `204`.

- **POST /auth/refresh** — Exchange a valid refresh token cookie for a new access token.  
  Returns: `{ data: { user, accessToken } }`  
  Errors: `401` (missing or expired refresh token)

- **GET /auth/me** — Returns the currently authenticated user. Requires Bearer token.  
  Returns: `{ data: { user } }`

## Houses

All house endpoints require authentication. Routes marked *(members only)* also require the user to be a member of that house.

- **GET /houses** — List houses the authenticated user is a member of.
- **POST /houses** — Create a new house. Body: `{ name: string }`. Auto-joins the creator.  
  Returns: `{ data: { house, member } }`
- **POST /houses/join** — Join a house using an invite code.  
  Body: `{ inviteCode: string }`.  
  Returns: `{ data: { house, member } }`  
  Errors: `404` (invalid code), `409` (already a member)
- **GET /houses/:houseId** *(members only)* — Get house details including `inviteCode`.

## Chore types *(members only)*

- **GET /houses/:houseId/chore-types** — List chore types for a house.
- **POST /houses/:houseId/chore-types** — Create a chore type. Body: `{ name: string, rotationOrder?: number }`.

## Members *(members only)*

- **GET /houses/:houseId/members** — List household members.
- **POST /houses/:houseId/members** — Add a member. Body: `{ displayName: string }`.
- **PATCH /houses/:houseId/members/:memberId** — Update a member. Body: `{ displayName?: string }`.
- **DELETE /houses/:houseId/members/:memberId** — Remove a member.

## Assignments *(members only)*

- **GET /houses/:houseId/assignments** — List assignments. Query: `choreTypeId`, `fromDate`, `toDate`, `includeCompleted` (default true).
- **POST /houses/:houseId/assignments** — Create an assignment. Body: `{ choreTypeId: string, memberId?: string, dueDate?: string (ISO), useRotation?: boolean }`. If `useRotation` is true and `memberId` is omitted, the next person in rotation is chosen.
- **PATCH /houses/:houseId/assignments/:assignmentId** — Update. Body: `{ memberId?: string, completedAt?: string | null }`.
- **POST /houses/:houseId/assignments/:assignmentId/complete** — Mark assignment complete (sets `completedAt` to now).

## Health

- **GET /health** — Returns `{ ok: true }`. No authentication required.
