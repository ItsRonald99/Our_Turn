import { Router } from 'express';
import { eq, inArray, and } from 'drizzle-orm';
import { randomUUID, randomInt } from 'crypto';
import { getDbSync, saveDb } from '../db/client.js';
import { houses, householdMembers, users } from '../db/schema.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireHouseMember } from '../middleware/requireHouseMember.js';
import { requireHouseOwner } from '../middleware/requireHouseOwner.js';
import { joinHouseLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const MAX_CODE_ATTEMPTS = 10;

// Returns a cryptographically secure random zero-padded 6-digit numeric string,
// e.g. '007342' or '982451'.
function generateInviteCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// Generates a code that does not already exist in the houses table.
// Retries up to MAX_CODE_ATTEMPTS times before giving up.
async function generateUniqueInviteCode(db) {
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const code = generateInviteCode();
    const [existing] = await db
      .select({ id: houses.id })
      .from(houses)
      .where(eq(houses.inviteCode, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique invite code. Please try again.');
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

    const [creator] = await db.select().from(users).where(eq(users.id, req.user.userId)).limit(1);

    const houseId = randomUUID();
    const inviteCode = await generateUniqueInviteCode(db);
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
      displayName: creator?.displayName ?? req.user.email,
      userId: req.user.userId,
      role: 'owner',
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
router.post('/join', requireAuth, joinHouseLimiter, async (req, res) => {
  try {
    const db = getDbSync();
    const { inviteCode } = req.body ?? {};
    if (!inviteCode || typeof inviteCode !== 'string') {
      return res.status(400).json({ error: 'inviteCode is required' });
    }
    const code = inviteCode.trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Invite code must be exactly 6 digits' });
    }

    const [house] = await db
      .select()
      .from(houses)
      .where(eq(houses.inviteCode, code))
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

    const [joiner] = await db.select().from(users).where(eq(users.id, req.user.userId)).limit(1);

    const memberId = randomUUID();
    await db.insert(householdMembers).values({
      id: memberId,
      houseId: house.id,
      displayName: joiner?.displayName ?? req.user.email,
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

/** DELETE /houses/:houseId — delete a house and all its data (owner only) */
router.delete('/:houseId', requireAuth, requireHouseMember, requireHouseOwner, async (req, res) => {
  try {
    const db = getDbSync();
    await db.delete(houses).where(eq(houses.id, req.params.houseId));
    saveDb();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
