import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { getDbSync } from '../db/client.js';
import { choreTypes } from '../db/schema.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireHouseMember } from '../middleware/requireHouseMember.js';
import { requireHouseOwner } from '../middleware/requireHouseOwner.js';
import { createChoreType, deleteChoreType } from '../services/choreTypeService.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireHouseMember);

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
    const { title, description } = req.body ?? {};
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    const row = await createChoreType(db, houseId, { title, description });
    res.status(201).json({ data: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /houses/:houseId/chore-types/:choreTypeId */
router.delete('/:choreTypeId', requireHouseOwner, async (req, res) => {
  try {
    const db = getDbSync();
    const { houseId, choreTypeId } = req.params;
    const deleted = await deleteChoreType(db, houseId, choreTypeId);
    if (!deleted) {
      return res.status(404).json({ error: 'Chore type not found' });
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
