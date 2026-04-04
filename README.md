# Our Turn

Household chore tracker for housemates. Manage chore assignments across multiple house groups, track who's up next, and get reminders when things are overdue.

## Quick start

1. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

2. **Configure environment**
   Copy `backend/.env.example` to `backend/.env`. The app works out of the box with defaults, but set `JWT_SECRET` for any non-throwaway use.

3. **Seed the database** *(first run only)*
   ```bash
   npm run db:seed
   ```
   Creates a default house ("Our House") with starter chore types: Garbage, Recycling, Snow shoveling.

4. **Run the app**
   ```bash
   npm run dev
   ```
   - Backend API: http://localhost:3001
   - Frontend: http://localhost:5173

## Features

- **Accounts** — register and log in; sessions are maintained via short-lived JWTs + httpOnly refresh token cookie
- **Account settings** — change your display name or password from any screen; changing a username propagates to all house groups you belong to
- **Multiple houses** — create or join any number of house groups; switch between them from the house selector, or tap the "Our Turn" heading from inside a house
- **Invite housemates** — share a 6-digit invite code, or send a direct invite by email
- **Roles** — house creators are owners (can delete the house and chore types); everyone else is a member
- **Chore types** — define the chores for each house (name + optional description)
- **Assignments** — assign chores to members with a due date; supports manual pick, rotation (auto-selects the next member), and recurring schedules (every N days, or a fixed weekday)
- **Completion dashboard** — per-house table showing how many of each chore type every member has completed; updates automatically when a chore is marked done
- **Reminders** — a daily job (8 AM UTC) emails each user a digest of overdue/due chores and creates in-app notifications; clicking a house name in a notification jumps straight to that house
- **Email** — configure SMTP env vars to send real emails; omit them to log digest output to the console instead

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run backend and frontend together |
| `npm run dev:backend` | API only (port 3001) |
| `npm run dev:frontend` | Frontend only (port 5173) |
| `npm run db:seed` | Seed default house and chore types |
| `npm run db:migrate` | Apply pending migrations (also runs on backend start) |
| `npm run build` | Build both backend and frontend |
| `cd backend && npm test` | Run backend tests |
| `cd frontend && npm test` | Run frontend tests |

## Environment variables

All variables live in `backend/.env`. The app uses Node's `--env-file-if-exists` flag — no dotenv package needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | insecure dev value | Signs access tokens |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `PORT` | `3001` | Backend listen port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `SMTP_HOST` | — | SMTP server (omit to log emails to console) |
| `SMTP_PORT` | — | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |

## Tech stack

- **Backend** — Node.js, Express, Drizzle ORM, SQLite via sql.js (pure JS — no native build step)
- **Frontend** — Vite, React, React Query, React Router

## Project structure

```
backend/
  src/
    db/          # schema, migrations, client (sql.js)
    middleware/  # requireAuth, requireHouseMember, requireHouseOwner, rateLimiter
    routes/      # auth, houses, chore-types, members, assignments, invitations, notifications, dashboard
    services/    # business logic (assignments, auth, reminders, email, notifications, dashboard)
    scripts/     # send-reminders.js (standalone reminder runner)
  drizzle/       # migration SQL files
frontend/
  src/
    api/         # thin fetch client (auto-refresh on 401)
    context/     # AuthContext (user, token, active house)
    hooks/       # React Query hooks by domain
    pages/       # Login, Register, HouseSelector, Home
    components/  # ChoreList, ChoreCard, ChoreManager, MemberList, AddAssignmentForm,
                 # NotificationBell, AccountSettings, ChoreDashboard
docs/            # API notes, data model, auth design
```
