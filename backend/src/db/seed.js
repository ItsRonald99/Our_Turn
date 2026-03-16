import { getDb, getDbSync, saveDb } from './client.js';
import { houses, choreTypes } from './schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const DEFAULT_HOUSE_ID = 'default-house';
const CHORE_NAMES = ['Garbage', 'Recycling', 'Snow shoveling'];

await getDb();
const db = getDbSync();

const existing = await db.select().from(houses).where(eq(houses.id, DEFAULT_HOUSE_ID)).limit(1);
if (existing.length > 0) {
  console.log('Default house already exists, skipping seed.');
  process.exit(0);
}

const now = new Date();
await db.insert(houses).values({
  id: DEFAULT_HOUSE_ID,
  name: 'Our House',
  createdAt: now,
});

for (let i = 0; i < CHORE_NAMES.length; i++) {
  await db.insert(choreTypes).values({
    id: randomUUID(),
    houseId: DEFAULT_HOUSE_ID,
    name: CHORE_NAMES[i],
    rotationOrder: i,
  });
}

saveDb();
console.log('Seeded default house and chore types (Garbage, Recycling, Snow shoveling).');
