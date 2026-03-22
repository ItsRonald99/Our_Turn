import { eq, and } from 'drizzle-orm';
import { getDbSync } from '../db/client.js';
import { householdMembers } from '../db/schema.js';

export async function requireHouseMember(req, res, next) {
  try {
    const db = getDbSync();
    const houseId = req.params.houseId;
    const userId = req.user?.userId;

    if (!houseId || !userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [member] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.houseId, houseId), eq(householdMembers.userId, userId)))
      .limit(1);

    if (!member) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.member = member;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
