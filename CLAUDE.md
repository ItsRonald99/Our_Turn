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

### Build
```bash
npm run build            # Build both backend and frontend
```

There are no tests currently in this project.

## Architecture

This is a monorepo with a Node/Express backend and a Vite/React frontend.

### Backend (`backend/`)

- **Entry:** `src/index.js` — sets up Express, mounts all routers, initializes the DB before listening.
- **DB client:** `src/db/client.js` — uses **sql.js** (pure JS, no native build) to run SQLite in-process. The DB is loaded from disk into memory on startup, and `saveDb()` must be called after every write to flush it back to disk (`backend/dev.sqlite`). Migrations run automatically at startup from SQL files in `backend/drizzle/`.
- **Schema:** `src/db/schema.js` — four tables: `houses`, `chore_types`, `household_members`, `chore_assignments`. All chore data is scoped by `house_id`. `household_members.user_id` is nullable, reserved for Phase 2 auth.
- **Routes:** `src/routes/` — one file per resource (`houses`, `choreTypes`, `members`, `assignments`), all mounted under `/houses/:houseId/...`.
- **Service layer:** `src/services/assignmentService.js` — contains all business logic (rotation, create/list/update assignments). Route handlers should delegate here rather than query the DB directly.
- **IDs:** All primary keys are UUIDs (`randomUUID()` from Node `crypto`), stored as text.

### Frontend (`frontend/`)

- **Entry:** `src/main.jsx` → `src/App.jsx` — wraps the app in a single `QueryClientProvider`; currently renders only `<Home />` (no router yet).
- **API client:** `src/api/client.js` — thin fetch wrapper that prefixes all requests with `/api` (proxied to `localhost:3001` by Vite in dev).
- **Hooks:** `src/hooks/` — React Query hooks (`useChores`, `useMembers`, `useHouse`) that call the API client. `useHouseId()` currently hard-codes `'default-house'` (Phase 1 single-house assumption).
- **Components:** `src/components/` — `ChoreList`, `ChoreCard`, `MemberList`, `AddAssignmentForm`.

### Key design decisions
- **Multi-tenant by design:** Every API route and DB query scopes data by `house_id`, even though Phase 1 only has one house (`'default-house'`). Don't add global state that bypasses house scoping.
- **sql.js write pattern:** After any insert/update/delete, call `saveDb()` to persist changes to disk. Forgetting this will silently discard writes on process exit.
- **Drizzle migrations:** Schema changes require running `npm run db:generate` (inside `backend/`) to produce a new `.sql` file in `backend/drizzle/`, then `npm run db:migrate` to apply it.
- **Vite proxy:** In development, `frontend/vite.config.js` proxies `/api/*` → `http://localhost:3001/*`, so the API client never needs an absolute URL in dev or prod (configure the proxy target for prod as needed).
