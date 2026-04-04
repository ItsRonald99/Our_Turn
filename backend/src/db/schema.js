import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const houses = sqliteTable('houses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const choreTypes = sqliteTable('chore_types', {
  id: text('id').primaryKey(),
  houseId: text('house_id').notNull().references(() => houses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  rotationOrder: integer('rotation_order').notNull().default(0),
});

export const householdMembers = sqliteTable('household_members', {
  id: text('id').primaryKey(),
  houseId: text('house_id').notNull().references(() => houses.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  role: text('role').notNull().default('member'), // 'owner' | 'member'
});

export const choreAssignments = sqliteTable('chore_assignments', {
  id: text('id').primaryKey(),
  houseId: text('house_id').notNull().references(() => houses.id, { onDelete: 'cascade' }),
  choreTypeId: text('chore_type_id').notNull().references(() => choreTypes.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => householdMembers.id, { onDelete: 'cascade' }),
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(0),
  recurrenceType: text('recurrence_type'),   // null | 'interval' | 'weekday'
  recurrenceValue: integer('recurrence_value'), // 'interval': N days; 'weekday': 0-6 (JS getDay())
  useRotation: integer('use_rotation', { mode: 'boolean' }).notNull().default(false),
  lastReminderSentAt: integer('last_reminder_sent_at', { mode: 'timestamp' }),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  houseId: text('house_id').references(() => houses.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const houseInvitations = sqliteTable('house_invitations', {
  id: text('id').primaryKey(),
  houseId: text('house_id').notNull().references(() => houses.id, { onDelete: 'cascade' }),
  inviterUserId: text('inviter_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  inviteeUserId: text('invitee_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'declined'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
