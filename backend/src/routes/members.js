import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { getDbSync, saveDb } from '../db/client.js';
import { householdMembers } from '../db/schema.js';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireHouseMember } from '../middleware/requireHouseMember.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireHouseMember);

/** GET /houses/:houseId/members */
router.get('/', async (req, res) => {
  try {
    const db = getDbSync();
    const houseId = req.params.houseId;
    const data = await db.select().from(householdMembers).where(eq(householdMembers.houseId, houseId));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /houses/:houseId/members */
router.post('/', async (req, res) => {
  try {
    const db = getDbSync();
    const houseId = req.params.houseId;
    const { displayName } = req.body ?? {};
    if (!displayName || typeof displayName !== 'string') {
      return res.status(400).json({ error: 'displayName is required' });
    }
    const id = randomUUID();
    await db.insert(householdMembers).values({
      id,
      houseId,
      displayName: displayName.trim(),
      userId: null,
    });
    saveDb();
    const [row] = await db.select().from(householdMembers).where(eq(householdMembers.id, id)).limit(1);
    res.status(201).json({ data: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /houses/:houseId/members/:memberId */
router.patch('/:memberId', async (req, res) => {
  try {
    const db = getDbSync();
    const { houseId, memberId } = req.params;
    const { displayName } = req.body ?? {};
    const [existing] = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.id, memberId))
      .limit(1);
    if (!existing || existing.houseId !== houseId) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const updates = {};
    if (typeof displayName === 'string') updates.displayName = displayName.trim();
    if (Object.keys(updates).length === 0) return res.json({ data: existing });
    await db.update(householdMembers).set(updates).where(eq(householdMembers.id, memberId));
    saveDb();
    const [row] = await db.select().from(householdMembers).where(eq(householdMembers.id, memberId)).limit(1);
    res.json({ data: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /houses/:houseId/members/:memberId */
router.delete('/:memberId', async (req, res) => {
  try {
    const db = getDbSync();
    const { houseId, memberId } = req.params;
    const [existing] = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.id, memberId))
      .limit(1);
    if (!existing || existing.houseId !== houseId) {
      return res.status(404).json({ error: 'Member not found' });
    }
    await db.delete(householdMembers).where(eq(householdMembers.id, memberId));
    saveDb();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
