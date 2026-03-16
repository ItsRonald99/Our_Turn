import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const houses = sqliteTable('houses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const choreTypes = sqliteTable('chore_types', {
  id: text('id').primaryKey(),
  houseId: text('house_id').notNull().references(() => houses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  rotationOrder: integer('rotation_order').notNull().default(0),
});

export const householdMembers = sqliteTable('household_members', {
  id: text('id').primaryKey(),
  houseId: text('house_id').notNull().references(() => houses.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  userId: text('user_id'), // nullable until Phase 2 auth
});

export const choreAssignments = sqliteTable('chore_assignments', {
  id: text('id').primaryKey(),
  houseId: text('house_id').notNull().references(() => houses.id, { onDelete: 'cascade' }),
  choreTypeId: text('chore_type_id').notNull().references(() => choreTypes.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => householdMembers.id, { onDelete: 'cascade' }),
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});
