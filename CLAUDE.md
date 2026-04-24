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

### Reminders
```bash
cd backend && npm run reminders:send           # Trigger the daily reminder job once (respects same-day dedup)
cd backend && npm run reminders:send -- --force  # Reset last_reminder_sent_at first, then re-run
```
The reminder script runs as a separate process — writes to disk but the running server's in-memory DB won't reflect them until restart. For live end-to-end testing use `POST /dev/send-reminders` (auth required, non-production only).

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
Copy `.env.example` to `.env` in `backend/`. All `npm run` scripts load it automatically via Node's `--env-file-if-exists` flag. Required: `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`. Optional for email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (omit to log digest emails to console). Optional for server: `PORT`, `CORS_ORIGIN`.

## Architecture

Monorepo: `backend/` is Node/Express, `frontend/` is Vite/React. In production both are served by the same Express process (React build copied into `backend/public/`). In development, Vite proxies `/api/*` → `http://localhost:3001` with no path rewriting.

### Backend (`backend/src/`)

- **Entry** `index.js` — mounts all routers under `/api`, initializes the DB before listening, schedules the daily reminder cron (`0 8 * * *` UTC, skipped in test env). Binds `0.0.0.0` for Docker/Railway. Serves the frontend static build in production.
- **DB client** `db/client.js` — uses **sql.js** (pure JS SQLite, no native build). The entire DB is loaded from disk into memory at startup; `saveDb()` must be called after every write to flush back to disk (`backend/dev.sqlite`). Migrations run automatically from SQL files in `backend/drizzle/` on startup.
- **Schema** `db/schema.js` — nine tables: `users`, `refresh_tokens`, `houses`, `chore_types`, `household_members`, `chore_assignments`, `notifications`, `house_invitations`, `manual_tally_adjustments`. All chore data is scoped by `house_id`. `PRAGMA foreign_keys = ON` is set on every init so `onDelete: 'cascade'` actually fires.
- **Routes** `routes/` — all mounted under `/api`. Route handlers delegate to services rather than querying the DB directly. The `/health` endpoint has no `/api` prefix (Railway health check).
- **Middleware** `middleware/requireAuth.js` → `requireHouseMember.js` → `requireHouseOwner.js` — must run in this order. `rateLimiter.js` auto-skips in `NODE_ENV=test`.
- **Services** `services/` — `assignmentService.js` (rotation logic), `authService.js` (JWT/bcrypt, `changePassword`, `changeUsername`), `choreTypeService.js`, `notificationService.js`, `emailService.js` (nodemailer, console fallback when SMTP unconfigured, forces `family: 4` for Railway IPv4), `reminderService.js` (queries due assignments, sends digest + in-app notifications, stamps `last_reminder_sent_at`), `dashboardService.js` (aggregates auto-completions + manual adjustment deltas, clamps counts to ≥ 0), `tallyService.js` (owner-only +1/−1 tally adjustments; `removeManualTally` enforces a server-side floor of 0 by querying the current total before inserting).
- **Test helpers** `test/helpers.js` — exports `makeChain(resolveValue)` and `createMockDb()` for mocking Drizzle in route tests.

### Frontend (`frontend/src/`)

- **Auth context** `context/AuthContext.jsx` — holds `user`, `accessToken`, `activeHouseId`, `isLoading` in memory. Exposes `updateUser(updates)` for partial merges (used after username change). On mount, silently refreshes via httpOnly cookie; uses `isMounted` ref to guard unmount.
- **API client** `api/client.js` — prefixes all requests with `/api`. On 401, refreshes the access token (deduped via `_refreshPromise`) then retries the original request. Skips refresh for `/auth/*` routes.
- **Hooks** `hooks/` — React Query hooks split by domain: `useChores.js` (assignments only), `useChoreTypes.js`, `useMembers.js`, `useHouse.js`, `useAuth.js`, `useInvitations.js`, `useNotifications.js`, `useAccount.js`, `useDashboard.js`. `useHouseId()` returns `activeHouseId` from context.
- **Pages** `pages/` — `Login`, `Register`, `HouseSelector` (post-login landing; create/join house), `Home` (main dashboard). `HouseSetup.jsx` exists but is unrouted — `HouseSelector` replaced it.

### Auth Flow
1. Register/login → short-lived JWT (15 m) in response body + long-lived refresh token (7 d) in httpOnly cookie.
2. Frontend stores JWT in memory (AuthContext); all requests send it as `Bearer`.
3. On 401, API client calls `POST /auth/refresh` (cookie auto-sent) → new JWT → retry.
4. On app load, AuthContext silently refreshes to restore session.

## Key Design Decisions

- **sql.js write pattern** — After any insert/update/delete, call `saveDb()`. Forgetting this silently discards writes on process exit. The in-memory model means concurrent processes (e.g., the reminder script and the running server) have separate DB states.
- **Multi-tenant scoping** — Every API route and DB query filters by `house_id`. Never add global state that bypasses house scoping.
- **Drizzle migrations** — The migration runner in `db/client.js` reads `.sql` files from `backend/drizzle/` alphabetically by filename and tracks applied files by name in `__drizzle_migrations`. It does **not** use a Drizzle Kit journal, so manually written `.sql` files are picked up automatically. For schema changes, run `npm run db:generate` inside `backend/` to produce a new file, then `npm run db:migrate`. You can also write migration files by hand (e.g. for constraints SQLite can't add via `ALTER TABLE`) — just name them in order.
- **API prefix consistency** — Frontend uses `BASE = '/api'` for all requests. Express mounts everything under `/api`. Vite dev proxy passes `/api/*` through without rewriting. This makes dev and production paths identical.
- **House invite codes** — 6-digit zero-padded numeric (e.g. `007342`). `POST /houses` calls `generateUniqueInviteCode()` with collision-retry. `POST /houses/join` validates `/^\d{6}$/` before querying. Creating a house makes the creator `role: 'owner'`; joining sets `role: 'member'`.
- **House roles** — `household_members.role` is `'owner'|'member'`. `requireHouseOwner` (must follow `requireHouseMember`) gates destructive ops: deleting a house, deleting chore types.
- **`changeUsername` sync** — Updates both `users.display_name` and every `household_members.display_name` row for that user to keep display names consistent across all house memberships.
- **Recurring assignments** — `chore_assignments` has `recurrence_type` (`'interval'|'weekday'`) and `recurrence_value`. When `markComplete` fires on a recurring assignment, `assignmentService.nextRecurringDueDate()` computes the next date and spawns a new assignment. All date arithmetic uses `getUTCDate`/`setUTCDate`/`getUTCDay` to avoid local-timezone off-by-one errors with ISO strings.
- **Daily reminders** — `node-cron` job in `index.js`. Finds uncompleted assignments where `due_date <= now` and `last_reminder_sent_at` is null or before today UTC. Email send is wrapped in its own try/catch — SMTP failure never blocks in-app notifications or the `last_reminder_sent_at` stamp.
- **Date display** — All due dates are UTC midnight timestamps. Always use `toISOString().slice(0, 10)`, never `toLocaleDateString()` — the latter shifts the date by the user's UTC offset.
- **Nullable `user_id` on members** — Allows legacy/guest members to coexist with authenticated users. The reminder service skips members where `user_id` is null.
- **React Query cache invalidation** — The `['dashboard', houseId]` cache is invalidated when `useCompleteAssignment` or `useAdjustTally` succeeds. Invitation and notification caches are invalidated on respond/mark-read.
- **Dashboard tally adjustments** — Manual owner adjustments are stored as individual delta rows (`+1` or `−1`) in `manual_tally_adjustments`, never as a running total. `dashboardService` sums them alongside auto-completions at read time. The `delta` column has a `CHECK(delta IN (1, -1))` constraint. `requireHouseOwner` middleware gates both tally routes.

## Reference Docs

`docs/` contains background design documents: `api.md` (route catalogue), `data-model.md` (entity relationships), `phase-2-auth.md` (auth design rationale). These are useful for understanding *why* decisions were made but may lag the current implementation — treat the source code and this file as authoritative.

## Deployment

Single Docker container on **Railway** serving both API and React frontend.

- **Dockerfile** — two-stage build: (1) Vite build → `frontend/dist/`, (2) backend production deps + copy frontend dist into `./public/`. Express serves it statically with an SPA catch-all.
- **`VOLUME` is banned by Railway** — volumes are configured in the Railway dashboard (Storage tab). Mount path: `/data`.
- **`DATABASE_URL=file:/data/production.sqlite`** — points to the mounted volume so the DB survives redeploys.
- **Cron runs inside the server process** — no Railway cron configuration needed.
- **IPv4 forced on SMTP** — Railway has no IPv6 outbound; nodemailer transporter uses `family: 4`.
- **Required production env vars** — `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `CORS_ORIGIN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
