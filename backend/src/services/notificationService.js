import { getDbSync, saveDb } from '../db/client.js';
import { notifications } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * Insert a notification row. Does NOT call saveDb() — callers that batch
 * multiple inserts should call saveDb() themselves after the batch.
 */
export async function createNotification({ userId, type, title, message }) {
  const db = getDbSync();
  const id = randomUUID();
  await db.insert(notifications).values({
    id,
    userId,
    type,
    title,
    message,
    isRead: false,
    createdAt: new Date(),
  });
  return id;
}

export async function listNotifications(userId) {
  const db = getDbSync();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));
}

export async function markNotificationRead(userId, notificationId) {
  const db = getDbSync();
  const [existing] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .limit(1);

  if (!existing) return null;

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  saveDb();

  const [updated] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);
  return updated;
}
