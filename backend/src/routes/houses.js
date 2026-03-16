import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { getDbSync } from '../db/client.js';
import { houses } from '../db/schema.js';

const router = Router();

/** GET /houses — list all houses */
router.get('/', async (_req, res) => {
  try {
    const db = getDbSync();
    const data = await db.select().from(houses);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /houses/:houseId — get one house */
router.get('/:houseId', async (req, res) => {
  try {
    const db = getDbSync();
    const [house] = await db.select().from(houses).where(eq(houses.id, req.params.houseId)).limit(1);
    if (!house) return res.status(404).json({ error: 'House not found' });
    res.json({ data: house });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
