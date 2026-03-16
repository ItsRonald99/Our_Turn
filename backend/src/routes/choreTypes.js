import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { getDbSync, saveDb } from '../db/client.js';
import { choreTypes } from '../db/schema.js';
import { randomUUID } from 'crypto';

const router = Router({ mergeParams: true });

/** GET /houses/:houseId/chore-types */
router.get('/', async (req, res) => {
  try {
    const db = getDbSync();
    const houseId = req.params.houseId;
    const data = await db.select().from(choreTypes).where(eq(choreTypes.houseId, houseId));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /houses/:houseId/chore-types */
router.post('/', async (req, res) => {
  try {
    const db = getDbSync();
    const houseId = req.params.houseId;
    const { name, rotationOrder = 0 } = req.body ?? {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    const id = randomUUID();
    await db.insert(choreTypes).values({
      id,
      houseId,
      name: name.trim(),
      rotationOrder: Number(rotationOrder) || 0,
    });
    saveDb();
    const [row] = await db.select().from(choreTypes).where(eq(choreTypes.id, id)).limit(1);
    res.status(201).json({ data: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
