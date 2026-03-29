import { getDbSync, saveDb } from '../db/client.js';
import { choreAssignments, householdMembers } from '../db/schema.js';
import { eq, and, desc, asc, gte, lte, isNull } from 'drizzle-orm';
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
    .orderBy(desc(choreAssignments.createdAt))
    .limit(1);

  if (lastAssignment.length === 0) return members[0];

  const lastMemberId = lastAssignment[0].memberId;
  const idx = members.findIndex((m) => m.id === lastMemberId);
  const nextIdx = (idx + 1) % members.length;
  return members[nextIdx];
}

/**
 * Calculate the next due date for a recurring assignment.
 * - 'interval': advance by recurrenceValue days (must be integer 1–365)
 * - 'weekday': find the next occurrence of recurrenceValue (0=Sun…6=Sat) after fromDate
 * Returns null for unknown/invalid types or out-of-range values.
 */
export function nextRecurringDueDate(fromDate, recurrenceType, recurrenceValue) {
  const d = new Date(fromDate);
  if (recurrenceType === 'interval') {
    if (!Number.isInteger(recurrenceValue) || recurrenceValue < 1 || recurrenceValue > 365) {
      return null;
    }
    d.setUTCDate(d.getUTCDate() + recurrenceValue);
    return d;
  }
  if (recurrenceType === 'weekday') {
    // Guard: must be a valid JS day integer (0=Sun … 6=Sat)
    if (!Number.isInteger(recurrenceValue) || recurrenceValue < 0 || recurrenceValue > 6) {
      return null;
    }
    // Advance at least 1 day so we never land on the same date
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() !== recurrenceValue) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return d;
  }
  return null;
}

/**
 * Create a new assignment, optionally using rotation to pick the member.
 */
export async function createAssignment(houseId, { choreTypeId, memberId, dueDate, useRotation, recurrenceType, recurrenceValue }) {
  if (recurrenceType != null) {
    if (!['interval', 'weekday'].includes(recurrenceType)) {
      throw new Error("recurrenceType must be 'interval' or 'weekday'");
    }
    if (recurrenceType === 'interval') {
      if (!Number.isInteger(recurrenceValue) || recurrenceValue < 1 || recurrenceValue > 365) {
        throw new Error('recurrenceValue must be a whole number between 1 and 365 for interval recurrence');
      }
    }
    if (recurrenceType === 'weekday') {
      if (!Number.isInteger(recurrenceValue) || recurrenceValue < 0 || recurrenceValue > 6) {
        throw new Error('recurrenceValue must be a whole number between 0 and 6 (Sun–Sat) for weekday recurrence');
      }
    }
  }

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
    createdAt: new Date(),
    recurrenceType: recurrenceType ?? null,
    recurrenceValue: recurrenceValue ?? null,
    useRotation: Boolean(useRotation),
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
  if (includeCompleted === false) conditions.push(isNull(choreAssignments.completedAt));

  const rows = await db
    .select()
    .from(choreAssignments)
    .where(and(...conditions))
    .orderBy(asc(choreAssignments.dueDate));
  return rows;
}

export async function updateAssignment(houseId, assignmentId, { memberId, completedAt, dueDate }) {
  const existing = await getAssignmentById(houseId, assignmentId);
  if (!existing) return null;

  const updates = {};
  if (memberId !== undefined) updates.memberId = memberId;
  if (completedAt !== undefined) updates.completedAt = completedAt ? new Date(completedAt) : null;
  if (dueDate !== undefined) {
    const parsed = new Date(dueDate);
    if (isNaN(parsed.getTime())) throw new Error('Invalid dueDate');
    updates.dueDate = parsed;
  }

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
  const completed = await updateAssignment(houseId, assignmentId, { completedAt: new Date() });
  if (!completed) return null;

  // Spawn the next occurrence if this is a recurring assignment
  if (completed.recurrenceType && completed.recurrenceValue !== null && completed.recurrenceValue !== undefined) {
    const nextDue = nextRecurringDueDate(completed.dueDate, completed.recurrenceType, completed.recurrenceValue);
    if (nextDue) {
      let nextMemberId = completed.memberId;
      if (completed.useRotation) {
        const next = await getNextAssignee(houseId, completed.choreTypeId);
        nextMemberId = next?.id ?? completed.memberId;
      }
      await createAssignment(houseId, {
        choreTypeId: completed.choreTypeId,
        memberId: nextMemberId,
        dueDate: nextDue,
        useRotation: completed.useRotation,
        recurrenceType: completed.recurrenceType,
        recurrenceValue: completed.recurrenceValue,
      });
    }
  }

  return completed;
}

export async function deleteAssignment(houseId, assignmentId) {
  const existing = await getAssignmentById(houseId, assignmentId);
  if (!existing) return null;

  const db = getDbSync();
  await db.delete(choreAssignments).where(
    and(
      eq(choreAssignments.houseId, houseId),
      eq(choreAssignments.id, assignmentId)
    )
  );
  saveDb();
  return true;
}
