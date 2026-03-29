# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev              # Run backend (port 3001) and frontend (port 5173) together
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only
```

### Database
```bash
npm run db:seed          # Seed default house ("Our House") and chore types — run once after first install
npm run db:migrate       # Run migrations manually (also runs automatically on backend start)
npm run db:generate      # Regenerate migration SQL from schema changes (run inside backend/)
```

### Build & Tests
```bash
npm run build            # Build both backend and frontend
cd backend && npm test   # Run backend tests (Vitest)
cd frontend && npm test  # Run frontend tests (Vitest)

# Run a single test file
cd frontend && npx vitest run src/components/__tests__/AddAssignmentForm.test.jsx
cd backend  && npx vitest run src/routes/__tests__/houses.test.js
```

### Environment
Copy `.env.example` to `.env` in `backend/`. Required vars:
- `JWT_SECRET` — secret for signing JWTs (defaults to insecure dev value if unset)
- `JWT_EXPIRES_IN` — access token lifetime (default: `15m`)
- `REFRESH_TOKEN_EXPIRES_IN` — refresh token lifetime (default: `7d`)

## Architecture

This is a monorepo with a Node/Express backend and a Vite/React frontend.

### Backend (`backend/`)

- **Entry:** `src/index.js` — sets up Express with CORS (origin: http://localhost:5173), cookie-parser, mounts all routers, initializes DB before listening.
- **DB client:** `src/db/client.js` — uses **sql.js** (pure JS, no native build) to run SQLite in-process. The DB is loaded from disk into memory on startup, and `saveDb()` must be called after every write to flush it back to disk (`backend/dev.sqlite`). Migrations run automatically at startup from SQL files in `backend/drizzle/`.
- **Schema:** `src/db/schema.js` — seven tables: `users`, `refresh_tokens`, `houses`, `chore_types`, `household_members`, `chore_assignments`, `house_invitations`. All chore data is scoped by `house_id`. `household_members.user_id` links to `users` (nullable for legacy/guest members). `household_members.role` is `'owner'|'member'` (default `'member'`).
- **Routes:** `src/routes/` — `auth.js` at `/auth`; `houses.js`, `choreTypes.js`, `members.js`, `assignments.js` under `/houses/:houseId/...`; `houseInvitations.js` at `/houses/:houseId/invitations`; `invitations.js` at `/invitations`.
- **Middleware:** `src/middleware/requireAuth.js` validates JWT and attaches `req.user`. `requireHouseMember.js` checks DB membership and attaches `req.member`. `requireHouseOwner.js` checks `req.member.role === 'owner'` — must run after `requireHouseMember`.
- **Service layer:** `src/services/assignmentService.js` (rotation logic) and `src/services/authService.js` (JWT/bcrypt). Route handlers should delegate here rather than query the DB directly.
- **IDs:** All primary keys are UUIDs (`randomUUID()` from Node `crypto`), stored as text.

### Frontend (`frontend/`)

- **Entry:** `src/main.jsx` → `src/App.jsx` — wraps the app in `QueryClientProvider` + `AuthProvider` + `BrowserRouter`. Routes: `/login`, `/register`, `/` (protected), `*` → `/`.
- **Auth context:** `src/context/AuthContext.jsx` — holds `user`, `accessToken`, `activeHouseId`, `isLoading`. On mount, attempts silent token refresh via httpOnly cookie; sets `isLoading=false` once complete. Uses `isMounted` ref to guard against state updates after unmount.
- **API client:** `src/api/client.js` — thin fetch wrapper prefixing all requests with `/api`. Automatically injects `Authorization` header, handles 401 by refreshing the access token (with request deduplication via `_refreshPromise`), then retries. Skips refresh for `/auth/*` endpoints.
- **Hooks:** `src/hooks/` — React Query hooks (`useChores`, `useMembers`, `useHouse`, `useAuth`) that call the API client. `useHouseId()` returns `activeHouseId` from auth context.
- **Pages:** `src/pages/` — `Login`, `Register`, `HouseSelector` (post-login landing; pick an existing house or create/join one inline), `Home` (main dashboard). `HouseSetup.jsx` exists but is no longer routed — `HouseSelector` covers that flow.
- **Components:** `src/components/` — `ProtectedRoute` (redirects to `/login` when unauthenticated), `ChoreList`, `ChoreCard`, `MemberList`, `AddAssignmentForm`, `NotificationBell` (polls `GET /invitations` every 30s, shows pending house invitations with accept/decline).
- **Hooks:** `src/hooks/useInvitations.js` — `useInvitations()` (React Query, 30s poll), `useInviteUser(houseId)`, `useRespondInvitation()` (invalidates invitations cache on success).

### Auth flow
1. Register/login → backend issues a short-lived JWT (15m) in the response body and a long-lived refresh token (7d) in an httpOnly cookie.
2. Frontend stores the JWT in memory (AuthContext); all API requests attach it as `Bearer` token.
3. On 401, the API client calls `POST /auth/refresh` (cookie sent automatically) to get a new JWT, then retries the original request.
4. On app load, AuthContext silently refreshes to restore session without requiring re-login.

### Key design decisions
- **Multi-tenant by design:** Every API route and DB query scopes data by `house_id`. Don't add global state that bypasses house scoping.
- **sql.js write pattern:** After any insert/update/delete, call `saveDb()` to persist changes to disk. Forgetting this will silently discard writes on process exit. `PRAGMA foreign_keys = ON` is set on every DB init (`client.js`), so `onDelete: 'cascade'` in the schema actually fires — deleting a house cascades to chore_types, household_members, and chore_assignments automatically.
- **Drizzle migrations:** Schema changes require running `npm run db:generate` (inside `backend/`) to produce a new `.sql` file in `backend/drizzle/`, then `npm run db:migrate` to apply it. Never edit generated `.sql` files directly.
- **Vite proxy:** In development, `frontend/vite.config.js` proxies `/api/*` → `http://localhost:3001/*`, so the API client never needs an absolute URL.
- **House invite codes:** Each house gets a unique 6-digit zero-padded numeric code (e.g. `007342`) stored in `houses.invite_code` with a `UNIQUE INDEX`. `POST /houses` calls `generateUniqueInviteCode(db)` which pre-checks for collisions and retries up to 10 times. `POST /houses/join` validates the format with `/^\d{6}$/` before querying. Creating a house auto-adds the creator as a member with `role: 'owner'`; joining via code or accepting an invitation sets `role: 'member'`.
- **House roles:** `household_members.role` is `'owner'|'member'`. Only `owner` can delete a house (`requireHouseOwner` middleware). Future roles (e.g. `moderator`) can be added by extending this column and creating a corresponding middleware.
- **User invitation flow:** `POST /houses/:houseId/invitations` looks up invitee by email, inserts a `house_invitations` row with `status: 'pending'`. `GET /invitations` returns pending invites for the authenticated user (enriched with `houseName` + `inviterName`). `POST /invitations/:id/respond` accepts `{action: 'accept'|'decline'}` — on accept, creates a `household_members` row (guarded against duplicates).
- **Member `displayName`:** Set from the user's `users.display_name` at join/create time. Falls back to `email` if the user record is not found.
- **Nullable `user_id` on members:** Allows legacy/guest household members from Phase 1 to coexist with authenticated users.
- **Recurring assignments:** `chore_assignments` has two nullable columns — `recurrence_type` (`'interval'|'weekday'`) and `recurrence_value` (N days or 0–6 weekday index). When `markComplete` is called on a recurring assignment, `assignmentService.nextRecurringDueDate()` computes the next due date and a new assignment is spawned automatically. All date arithmetic in that function uses `getUTCDate`/`setUTCDate`/`getUTCDay` to avoid local-timezone off-by-one errors with ISO date strings.
