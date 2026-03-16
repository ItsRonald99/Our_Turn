# Data model

All house-scoped tables include `house_id` for multi-tenant support (Phase 3).

## Tables

- **houses** — `id`, `name`, `created_at`
- **chore_types** — `id`, `house_id`, `name`, `rotation_order`
- **household_members** — `id`, `house_id`, `display_name`, `user_id` (nullable until auth)
- **chore_assignments** — `id`, `house_id`, `chore_type_id`, `member_id`, `due_date`, `completed_at` (nullable)

## Indexes

- `chore_types(house_id)`, `household_members(house_id)`, `chore_assignments(house_id)` for fast house-scoped queries.

## Rotation

Rotation is round-robin by last assignment: the next assignee is the next member after the last one who was assigned for that chore type. Implemented in `backend/src/services/assignmentService.js` (`getNextAssignee`).
