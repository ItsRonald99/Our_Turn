# API

All resources are scoped by house. Base URL in development: `http://localhost:3001` (frontend proxies `/api` to this).

Responses use `{ data }` on success and `{ error: "message" }` on failure.

## Houses

- **GET /houses** — List all houses.
- **GET /houses/:houseId** — Get one house.

## Chore types

- **GET /houses/:houseId/chore-types** — List chore types for a house.
- **POST /houses/:houseId/chore-types** — Create a chore type. Body: `{ name: string, rotationOrder?: number }`.

## Members

- **GET /houses/:houseId/members** — List household members.
- **POST /houses/:houseId/members** — Add a member. Body: `{ displayName: string }`.
- **PATCH /houses/:houseId/members/:memberId** — Update a member. Body: `{ displayName?: string }`.
- **DELETE /houses/:houseId/members/:memberId** — Remove a member.

## Assignments

- **GET /houses/:houseId/assignments** — List assignments. Query: `choreTypeId`, `fromDate`, `toDate`, `includeCompleted` (default true).
- **POST /houses/:houseId/assignments** — Create an assignment. Body: `{ choreTypeId: string, memberId?: string, dueDate?: string (ISO), useRotation?: boolean }`. If `useRotation` is true and `memberId` is omitted, the next person in rotation is chosen.
- **PATCH /houses/:houseId/assignments/:assignmentId** — Update. Body: `{ memberId?: string, completedAt?: string | null }`.
- **POST /houses/:houseId/assignments/:assignmentId/complete** — Mark assignment complete (sets `completedAt` to now).

## Health

- **GET /health** — Returns `{ ok: true }`.
