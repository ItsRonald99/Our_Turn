import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { choreTypes } from '../db/schema.js';
import { saveDb } from '../db/client.js';

export async function createChoreType(db, houseId, { title, description = null }) {
  const id = randomUUID();
  await db.insert(choreTypes).values({
    id,
    houseId,
    name: title.trim(),
    description: description ? description.trim() : null,
    rotationOrder: 0,
  });
  saveDb();
  const [row] = await db.select().from(choreTypes).where(eq(choreTypes.id, id)).limit(1);
  return row;
}

export async function deleteChoreType(db, houseId, choreTypeId) {
  const [existing] = await db
    .select()
    .from(choreTypes)
    .where(and(eq(choreTypes.id, choreTypeId), eq(choreTypes.houseId, houseId)))
    .limit(1);
  if (!existing) return null;

  await db.delete(choreTypes).where(and(eq(choreTypes.id, choreTypeId), eq(choreTypes.houseId, houseId)));
  saveDb();
  return existing;
}
