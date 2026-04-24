import { randomUUID } from 'crypto';
import { eq, and, isNotNull } from 'drizzle-orm';
import { manualTallyAdjustments, householdMembers, choreTypes, choreAssignments } from '../db/schema.js';
import { saveDb } from '../db/client.js';

async function validateInputs(db, houseId, memberId, choreTypeId) {
  const [member] = await db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.id, memberId), eq(householdMembers.houseId, houseId)))
    .limit(1);
  if (!member) {
    const err = new Error('Member not found');
    err.status = 404;
    throw err;
  }

  const [choreType] = await db
    .select()
    .from(choreTypes)
    .where(and(eq(choreTypes.id, choreTypeId), eq(choreTypes.houseId, houseId)))
    .limit(1);
  if (!choreType) {
    const err = new Error('Chore type not found');
    err.status = 404;
    throw err;
  }
}

async function insertAdjustment(db, houseId, memberId, choreTypeId, delta) {
  const id = randomUUID();
  await db.insert(manualTallyAdjustments).values({
    id,
    houseId,
    memberId,
    choreTypeId,
    delta,
    createdAt: new Date(),
  });
  saveDb();
  return { id, houseId, memberId, choreTypeId, delta };
}

export async function addManualTally(db, houseId, memberId, choreTypeId) {
  await validateInputs(db, houseId, memberId, choreTypeId);
  return insertAdjustment(db, houseId, memberId, choreTypeId, 1);
}

export async function removeManualTally(db, houseId, memberId, choreTypeId) {
  await validateInputs(db, houseId, memberId, choreTypeId);

  const [completedRows, adjustmentRows] = await Promise.all([
    db
      .select()
      .from(choreAssignments)
      .where(
        and(
          eq(choreAssignments.memberId, memberId),
          eq(choreAssignments.choreTypeId, choreTypeId),
          isNotNull(choreAssignments.completedAt)
        )
      ),
    db
      .select()
      .from(manualTallyAdjustments)
      .where(
        and(
          eq(manualTallyAdjustments.memberId, memberId),
          eq(manualTallyAdjustments.choreTypeId, choreTypeId)
        )
      ),
  ]);

  const currentTotal =
    completedRows.length +
    adjustmentRows.reduce((sum, adj) => sum + adj.delta, 0);

  if (currentTotal <= 0) {
    const err = new Error('Tally is already at zero');
    err.status = 400;
    throw err;
  }

  return insertAdjustment(db, houseId, memberId, choreTypeId, -1);
}
