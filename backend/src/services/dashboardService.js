import { getDbSync } from '../db/client.js';
import { choreAssignments, householdMembers, choreTypes, manualTallyAdjustments } from '../db/schema.js';
import { eq, and, isNotNull } from 'drizzle-orm';

/**
 * Returns completed-chore counts per member per chore type for a house.
 *
 * Return shape:
 * {
 *   members: [{ memberId, displayName, chores: { [choreTypeId]: count } }],
 *   choreTypes: [{ id, name }]
 * }
 */
export async function getChoreCompletionStats(houseId) {
  const db = getDbSync();

  const [members, types, completed, adjustments] = await Promise.all([
    db.select().from(householdMembers).where(eq(householdMembers.houseId, houseId)),
    db.select().from(choreTypes).where(eq(choreTypes.houseId, houseId)),
    db
      .select()
      .from(choreAssignments)
      .where(
        and(
          eq(choreAssignments.houseId, houseId),
          isNotNull(choreAssignments.completedAt)
        )
      ),
    db.select().from(manualTallyAdjustments).where(eq(manualTallyAdjustments.houseId, houseId)),
  ]);

  // Build count map: memberId → choreTypeId → count (auto-completed assignments)
  const countMap = {};
  for (const row of completed) {
    if (!countMap[row.memberId]) countMap[row.memberId] = {};
    countMap[row.memberId][row.choreTypeId] =
      (countMap[row.memberId][row.choreTypeId] ?? 0) + 1;
  }

  // Apply manual adjustments on top of auto counts
  for (const adj of adjustments) {
    if (!countMap[adj.memberId]) countMap[adj.memberId] = {};
    countMap[adj.memberId][adj.choreTypeId] =
      (countMap[adj.memberId][adj.choreTypeId] ?? 0) + adj.delta;
  }

  return {
    members: members.map((m) => ({
      memberId: m.id,
      displayName: m.displayName,
      chores: Object.fromEntries(
        Object.entries(countMap[m.id] ?? {}).map(([k, v]) => [k, Math.max(0, v)])
      ),
    })),
    choreTypes: types.map((t) => ({ id: t.id, name: t.name })),
  };
}
