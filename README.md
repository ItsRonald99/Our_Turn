# Our Turn

Household chore tracker for housemates: track who is responsible for garbage, recycling, snow shoveling, and other chores.

## Quick start

1. **Install and set up**
   ```bash
   npm install
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

2. **Database (SQLite by default)**  
   Migrations run automatically when the backend starts. Seed the default house and chore types once:
   ```bash
   npm run db:seed
   ```
   This creates one house (“Our House”) and chore types: Garbage, Recycling, Snow shoveling.

3. **Run the app**
   ```bash
   npm run dev
   ```
   - Backend: http://localhost:3001  
   - Frontend: http://localhost:5173 (proxies API to `/api`)

4. **Use the app**  
   Open http://localhost:5173. Add housemates, then create assignments (with or without “rotate” to pick the next person). Mark assignments done when complete.

## Project structure

- `backend/` — Express API, Drizzle ORM, SQLite (dev) / PostgreSQL (production-ready)
- `frontend/` — Vite + React, React Query
- `docs/` — API and data model notes

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Run backend and frontend together |
| `npm run dev:backend` | Run API only (port 3001) |
| `npm run dev:frontend` | Run frontend only (port 5173) |
| `npm run db:seed` | Seed default house and chore types |
| `npm run db:migrate` | Run DB migrations (also run on backend start) |

## Environment

- **Backend:** copy `backend/.env.example` to `backend/.env` if you need to set `DATABASE_URL` or `PORT`. Default: SQLite at `backend/dev.sqlite`, port 3001. The app uses **sql.js** (no native build) so it runs without compiling native modules.
- **Frontend:** API is proxied from `/api` to `http://localhost:3001` in development.

## Roadmap

- **Phase 2:** User authentication; link users to household members. ✅ Complete — see [docs/phase-2-auth.md](docs/phase-2-auth.md) for the implementation plan.
- **Phase 3:** Multiple house groups; switch house in the UI.
