import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDbSync, saveDb } from '../db/client.js';
import { houseInvitations, householdMembers, users } from '../db/schema.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireHouseMember } from '../middleware/requireHouseMember.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireHouseMember);

/** POST /houses/:houseId/invitations — invite a registered user to this house by email */
router.post('/', async (req, res) => {
  try {
    const db = getDbSync();
    const { houseId } = req.params;
    const { email } = req.body ?? {};

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'email is required' });
    }

    // Resolve invitee by email (case-insensitive)
    const [invitee] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    if (!invitee) return res.status(404).json({ error: 'No user found with that email' });

    // Cannot invite yourself
    if (invitee.id === req.user.userId) {
      return res.status(400).json({ error: 'You cannot invite yourself' });
    }

    // Invitee must not already be a member
    const [existingMember] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.houseId, houseId), eq(householdMembers.userId, invitee.id)))
      .limit(1);
    if (existingMember) {
      return res.status(409).json({ error: 'User is already a member of this house' });
    }

    // No duplicate pending invite
    const [pendingInvite] = await db
      .select()
      .from(houseInvitations)
      .where(and(
        eq(houseInvitations.houseId, houseId),
        eq(houseInvitations.inviteeUserId, invitee.id),
        eq(houseInvitations.status, 'pending')
      ))
      .limit(1);
    if (pendingInvite) {
      return res.status(409).json({ error: 'A pending invitation already exists for this user' });
    }

    const id = randomUUID();
    await db.insert(houseInvitations).values({
      id,
      houseId,
      inviterUserId: req.user.userId,
      inviteeUserId: invitee.id,
      status: 'pending',
      createdAt: new Date(),
    });
    saveDb();

    const [row] = await db
      .select()
      .from(houseInvitations)
      .where(eq(houseInvitations.id, id))
      .limit(1);
    res.status(201).json({ data: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
