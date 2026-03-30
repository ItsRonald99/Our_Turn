/**
 * Manually trigger the daily reminder job.
 *
 * Usage:
 *   node src/scripts/send-reminders.js           # dry-run (respects dedup)
 *   node src/scripts/send-reminders.js --force   # clears last_reminder_sent_at first
 *
 * Or via npm:
 *   npm run reminders:send
 *   npm run reminders:send -- --force
 */

import { getDb, getDbSync, saveDb } from '../db/client.js';
import { choreAssignments } from '../db/schema.js';
import { isNotNull } from 'drizzle-orm';
import { sendDailyReminders } from '../services/reminderService.js';

const force = process.argv.includes('--force');

console.log('Initializing database…');
await getDb();

if (force) {
  console.log('--force: clearing last_reminder_sent_at on all assignments so they are eligible again…');
  const db = getDbSync();
  await db
    .update(choreAssignments)
    .set({ lastReminderSentAt: null })
    .where(isNotNull(choreAssignments.lastReminderSentAt));
  saveDb();
}

console.log('Running daily reminders…');
const { usersNotified, assignmentsProcessed } = await sendDailyReminders();

if (assignmentsProcessed === 0) {
  console.log('No eligible assignments found.');
  console.log('Tip: use --force to re-send even if reminders were already sent today.');
} else {
  console.log(`Done: ${usersNotified} user(s) notified across ${assignmentsProcessed} assignment(s).`);
}
