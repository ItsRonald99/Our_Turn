import { getDbSync, saveDb } from '../db/client.js';
import { choreAssignments, householdMembers, users, choreTypes, houses } from '../db/schema.js';
import { eq, and, lte, isNull, or, lt } from 'drizzle-orm';
import { sendDigestEmail } from './emailService.js';
import { createNotification } from './notificationService.js';

/**
 * Run daily reminders:
 *  - Find all uncompleted assignments due today or earlier that haven't been
 *    reminded yet today (UTC).
 *  - Group by user, send one digest email per user, create in-app notifications,
 *    then stamp last_reminder_sent_at so they won't fire again today.
 *
 * @param {{ force?: boolean }} options
 *   force — when true, skips the same-day dedup check (useful for dev/testing)
 *
 * Returns { usersNotified, assignmentsProcessed }.
 */
export async function sendDailyReminders({ force = false } = {}) {
  const db = getDbSync();

  const now = new Date();
  // Start of today in UTC — used as the "already reminded today" cutoff
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Assignments that are: incomplete, due now or earlier, not yet reminded today
  // (dedup check skipped when force=true)
  const dedupCondition = force
    ? null
    : or(
        isNull(choreAssignments.lastReminderSentAt),
        lt(choreAssignments.lastReminderSentAt, todayStart)
      );

  const whereClause = dedupCondition
    ? and(isNull(choreAssignments.completedAt), lte(choreAssignments.dueDate, now), dedupCondition)
    : and(isNull(choreAssignments.completedAt), lte(choreAssignments.dueDate, now));

  const dueAssignments = await db
    .select()
    .from(choreAssignments)
    .where(whereClause);

  if (dueAssignments.length === 0) {
    return { usersNotified: 0, assignmentsProcessed: 0 };
  }

  // Enrich each assignment with user / chore name / house name
  const enriched = await Promise.all(
    dueAssignments.map(async (assignment) => {
      const [member] = await db
        .select()
        .from(householdMembers)
        .where(eq(householdMembers.id, assignment.memberId))
        .limit(1);

      if (!member?.userId) return null; // unlinked/guest member — skip

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, member.userId))
        .limit(1);

      if (!user) return null;

      const [choreType] = await db
        .select()
        .from(choreTypes)
        .where(eq(choreTypes.id, assignment.choreTypeId))
        .limit(1);

      const [house] = await db
        .select()
        .from(houses)
        .where(eq(houses.id, assignment.houseId))
        .limit(1);

      return {
        assignment,
        user,
        choreName: choreType?.name ?? 'Unknown chore',
        houseName: house?.name ?? 'Unknown house',
      };
    })
  );

  const valid = enriched.filter(Boolean);

  // Group by userId so each user gets exactly one email
  const byUser = new Map();
  for (const item of valid) {
    const uid = item.user.id;
    if (!byUser.has(uid)) {
      byUser.set(uid, { user: item.user, items: [] });
    }
    byUser.get(uid).items.push(item);
  }

  let usersNotified = 0;

  for (const { user, items } of byUser.values()) {
    // Email is best-effort — a send failure must not block in-app notifications.
    try {
      await sendDigestEmail({
        toEmail: user.email,
        userName: user.displayName,
        assignments: items.map(({ choreName, houseName, assignment }) => ({
          choreName,
          houseName,
          dueDate: assignment.dueDate,
        })),
      });
    } catch (err) {
      console.error(`[reminderService] Email failed for user ${user.id}:`, err.message);
    }

    // In-app notifications and stamping run regardless of email outcome.
    try {
      for (const { assignment, choreName, houseName } of items) {
        const isOverdue = new Date(assignment.dueDate) < todayStart;
        await createNotification({
          userId: user.id,
          houseId: assignment.houseId,
          type: 'assignment_reminder',
          title: 'Chore Due',
          message: `${choreName} is ${isOverdue ? 'overdue' : 'due'} in ${houseName}`,
        });
      }

      // Stamp all processed assignments so they won't fire again today
      for (const { assignment } of items) {
        await db
          .update(choreAssignments)
          .set({ lastReminderSentAt: now })
          .where(eq(choreAssignments.id, assignment.id));
      }

      saveDb();
      usersNotified++;
    } catch (err) {
      console.error(`[reminderService] Notification failed for user ${user.id}:`, err.message);
    }
  }

  return { usersNotified, assignmentsProcessed: valid.length };
}
