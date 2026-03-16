import { getDbSync, saveDb } from '../db/client.js';
import { choreAssignments, householdMembers } from '../db/schema.js';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * Get the next member in rotation for a chore type (round-robin by last assignment).
 */
export async function getNextAssignee(houseId, choreTypeId) {
  const db = getDbSync();
  const members = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.houseId, houseId));

  if (members.length === 0) return null;

  const lastAssignment = await db
    .select()
    .from(choreAssignments)
    .where(
      and(
        eq(choreAssignments.houseId, houseId),
        eq(choreAssignments.choreTypeId, choreTypeId)
      )
    )
    .orderBy(desc(choreAssignments.dueDate))
    .limit(1);

  if (lastAssignment.length === 0) return members[0];

  const lastMemberId = lastAssignment[0].memberId;
  const idx = members.findIndex((m) => m.id === lastMemberId);
  const nextIdx = (idx + 1) % members.length;
  return members[nextIdx];
}

/**
 * Create a new assignment, optionally using rotation to pick the member.
 */
export async function createAssignment(houseId, { choreTypeId, memberId, dueDate, useRotation }) {
  let assigneeId = memberId;
  if (useRotation && !assigneeId) {
    const next = await getNextAssignee(houseId, choreTypeId);
    assigneeId = next?.id ?? null;
  }
  if (!assigneeId) {
    throw new Error('No member specified and rotation could not determine one (no members?).');
  }

  const db = getDbSync();
  const id = randomUUID();
  const due = dueDate ? new Date(dueDate) : new Date();
  await db.insert(choreAssignments).values({
    id,
    houseId,
    choreTypeId,
    memberId: assigneeId,
    dueDate: due,
    completedAt: null,
  });
  saveDb();
  return getAssignmentById(houseId, id);
}

export async function getAssignmentById(houseId, assignmentId) {
  const db = getDbSync();
  const rows = await db
    .select()
    .from(choreAssignments)
    .where(
      and(
        eq(choreAssignments.houseId, houseId),
        eq(choreAssignments.id, assignmentId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listAssignments(houseId, { choreTypeId, fromDate, toDate, includeCompleted = true } = {}) {
  const db = getDbSync();
  const conditions = [eq(choreAssignments.houseId, houseId)];
  if (choreTypeId) conditions.push(eq(choreAssignments.choreTypeId, choreTypeId));
  if (fromDate) conditions.push(gte(choreAssignments.dueDate, new Date(fromDate)));
  if (toDate) conditions.push(lte(choreAssignments.dueDate, new Date(toDate)));
  if (includeCompleted === false) conditions.push(eq(choreAssignments.completedAt, null));

  const rows = await db
    .select()
    .from(choreAssignments)
    .where(and(...conditions))
    .orderBy(asc(choreAssignments.dueDate));
  return rows;
}

export async function updateAssignment(houseId, assignmentId, { memberId, completedAt }) {
  const existing = await getAssignmentById(houseId, assignmentId);
  if (!existing) return null;

  const updates = {};
  if (memberId !== undefined) updates.memberId = memberId;
  if (completedAt !== undefined) updates.completedAt = completedAt ? new Date(completedAt) : null;

  if (Object.keys(updates).length === 0) return existing;

  const db = getDbSync();
  await db.update(choreAssignments)
    .set(updates)
    .where(
      and(
        eq(choreAssignments.houseId, houseId),
        eq(choreAssignments.id, assignmentId)
      )
    );
  saveDb();
  return getAssignmentById(houseId, assignmentId);
}

export async function markComplete(houseId, assignmentId) {
  return updateAssignment(houseId, assignmentId, { completedAt: new Date() });
}
