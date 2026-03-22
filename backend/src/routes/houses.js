import { Router } from 'express';
import { eq, inArray, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDbSync, saveDb } from '../db/client.js';
import { houses, householdMembers } from '../db/schema.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireHouseMember } from '../middleware/requireHouseMember.js';

const router = Router();

function generateInviteCode() {
  return randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
}

/** GET /houses — list the authenticated user's houses */
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDbSync();
    const memberships = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, req.user.userId));

    if (memberships.length === 0) return res.json({ data: [] });

    const houseIds = memberships.map((m) => m.houseId);
    const data = await db.select().from(houses).where(inArray(houses.id, houseIds));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /houses — create a new house (creator auto-joins as member) */
router.post('/', requireAuth, async (req, res) => {
  try {
    const db = getDbSync();
    const { name } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const houseId = randomUUID();
    const inviteCode = generateInviteCode();
    await db.insert(houses).values({
      id: houseId,
      name: name.trim(),
      inviteCode,
      createdAt: new Date(),
    });

    const memberId = randomUUID();
    await db.insert(householdMembers).values({
      id: memberId,
      houseId,
      displayName: req.user.email,
      userId: req.user.userId,
    });
    saveDb();

    const [house] = await db.select().from(houses).where(eq(houses.id, houseId)).limit(1);
    const [member] = await db.select().from(householdMembers).where(eq(householdMembers.id, memberId)).limit(1);
    res.status(201).json({ data: { house, member } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /houses/join — join a house using an invite code */
router.post('/join', requireAuth, async (req, res) => {
  try {
    const db = getDbSync();
    const { inviteCode } = req.body ?? {};
    if (!inviteCode || typeof inviteCode !== 'string') {
      return res.status(400).json({ error: 'inviteCode is required' });
    }

    const [house] = await db
      .select()
      .from(houses)
      .where(eq(houses.inviteCode, inviteCode.toUpperCase().trim()))
      .limit(1);
    if (!house) return res.status(404).json({ error: 'Invalid invite code' });

    const [existingMembership] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.houseId, house.id), eq(householdMembers.userId, req.user.userId)))
      .limit(1);
    if (existingMembership) {
      return res.status(409).json({ error: 'Already a member of this house' });
    }

    const memberId = randomUUID();
    await db.insert(householdMembers).values({
      id: memberId,
      houseId: house.id,
      displayName: req.user.email,
      userId: req.user.userId,
    });
    saveDb();

    const [member] = await db.select().from(householdMembers).where(eq(householdMembers.id, memberId)).limit(1);
    res.status(201).json({ data: { house, member } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /houses/:houseId — get one house (members only) */
router.get('/:houseId', requireAuth, requireHouseMember, async (req, res) => {
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
