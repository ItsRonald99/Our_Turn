import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDbSync, saveDb } from '../db/client.js';
import { houseInvitations, householdMembers, houses, users } from '../db/schema.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);

/** GET /invitations — pending invitations for the current user, enriched with house/inviter names */
router.get('/', async (req, res) => {
  try {
    const db = getDbSync();
    const pending = await db
      .select()
      .from(houseInvitations)
      .where(and(
        eq(houseInvitations.inviteeUserId, req.user.userId),
        eq(houseInvitations.status, 'pending')
      ))
      .orderBy(desc(houseInvitations.createdAt));

    if (pending.length === 0) return res.json({ data: [] });

    // Enrich with house name and inviter display name (separate queries to stay
    // consistent with the rest of the codebase which avoids JOIN syntax).
    const enriched = await Promise.all(pending.map(async (inv) => {
      const [house] = await db
        .select({ name: houses.name })
        .from(houses)
        .where(eq(houses.id, inv.houseId))
        .limit(1);
      const [inviter] = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, inv.inviterUserId))
        .limit(1);
      return {
        ...inv,
        houseName: house?.name ?? 'Unknown house',
        inviterName: inviter?.displayName ?? 'Unknown user',
      };
    }));

    res.json({ data: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /invitations/:id/respond — accept or decline an invitation */
router.post('/:id/respond', async (req, res) => {
  try {
    const db = getDbSync();
    const { action } = req.body ?? {};

    if (!action || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
    }

    const [invitation] = await db
      .select()
      .from(houseInvitations)
      .where(eq(houseInvitations.id, req.params.id))
      .limit(1);

    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.inviteeUserId !== req.user.userId) {
      return res.status(403).json({ error: 'Not your invitation' });
    }
    if (invitation.status !== 'pending') {
      return res.status(409).json({ error: 'Invitation has already been responded to' });
    }

    if (action === 'accept') {
      // Guard: user may have already joined via invite code between invite send and accept
      const [existingMember] = await db
        .select()
        .from(householdMembers)
        .where(and(
          eq(householdMembers.houseId, invitation.houseId),
          eq(householdMembers.userId, req.user.userId)
        ))
        .limit(1);

      if (!existingMember) {
        const [invitee] = await db
          .select()
          .from(users)
          .where(eq(users.id, req.user.userId))
          .limit(1);
        await db.insert(householdMembers).values({
          id: randomUUID(),
          houseId: invitation.houseId,
          displayName: invitee?.displayName ?? req.user.email,
          userId: req.user.userId,
        });
      }
    }

    await db
      .update(houseInvitations)
      .set({ status: action === 'accept' ? 'accepted' : 'declined' })
      .where(eq(houseInvitations.id, invitation.id));
    saveDb();

    const [updated] = await db
      .select()
      .from(houseInvitations)
      .where(eq(houseInvitations.id, invitation.id))
      .limit(1);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
