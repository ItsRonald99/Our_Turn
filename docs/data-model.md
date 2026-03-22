# Data model

All house-scoped tables include `house_id` for multi-tenant support (Phase 3).

## Tables

### Phase 1

- **houses** — `id`, `name`, `invite_code` (6-char alphanumeric, UNIQUE), `created_at`
- **chore_types** — `id`, `house_id`, `name`, `rotation_order`
- **household_members** — `id`, `house_id`, `display_name`, `user_id` (FK → users, nullable for guest members)
- **chore_assignments** — `id`, `house_id`, `chore_type_id`, `member_id`, `due_date`, `completed_at` (nullable)

### Phase 2 (authentication)

- **users** — `id`, `email` (UNIQUE), `password_hash`, `display_name`, `created_at`  
  Stores authenticated user accounts. Passwords are hashed with bcrypt (cost 12).

- **refresh_tokens** — `id`, `user_id` (FK → users, cascade delete), `token` (UUID, UNIQUE), `expires_at`, `created_at`  
  One row per active browser session. Deleted on logout or expiry. Allows invalidation without rotating JWT secrets.

## Indexes

- `users(email)` — fast login lookup
- `refresh_tokens(token)` — fast token lookup on `/auth/refresh`
- `refresh_tokens(user_id)` — fast delete-all-sessions for a user
- `chore_types(house_id)`, `household_members(house_id)`, `chore_assignments(house_id)` — fast house-scoped queries
- `houses(invite_code)` — fast invite code lookup on `/houses/join`

## Migrations

| File | Contents |
| --- | --- |
| `drizzle/0000_initial.sql` | Create `houses`, `chore_types`, `household_members`, `chore_assignments` |
| `drizzle/0001_add_auth.sql` | Add `users`, `refresh_tokens`; add `invite_code` to `houses` |

## Rotation

Rotation is round-robin by last assignment: the next assignee is the next member after the last one who was assigned for that chore type. Implemented in `backend/src/services/assignmentService.js` (`getNextAssignee`).

## Auth token strategy

- **Access token** — JWT signed with `JWT_SECRET`, 15-minute TTL. Kept in React memory only (never localStorage).
- **Refresh token** — Random UUID stored in `refresh_tokens` table, 7-day TTL. Sent to the browser as an `httpOnly; SameSite=Lax` cookie. Used at `POST /auth/refresh` to renew the access token transparently.

This pattern prevents XSS from stealing the refresh token while keeping the access token short-lived.
