import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain, createMockDb } from '../../test/helpers.js';

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn(),
  saveDb: vi.fn(),
}));

import { getDbSync, saveDb } from '../../db/client.js';
import * as service from '../assignmentService.js';

describe('assignmentService', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  // ---------------------------------------------------------------------------
  // getNextAssignee
  // ---------------------------------------------------------------------------
  describe('getNextAssignee', () => {
    it('returns null when there are no members', async () => {
      mockDb.select.mockReturnValue(makeChain([]));
      const result = await service.getNextAssignee('house-1', 'chore-1');
      expect(result).toBeNull();
    });

    it('returns first member when no prior assignment exists', async () => {
      const members = [
        { id: 'member-1', displayName: 'Alice' },
        { id: 'member-2', displayName: 'Bob' },
      ];
      mockDb.select
        .mockReturnValueOnce(makeChain(members))  // members query
        .mockReturnValueOnce(makeChain([]));       // last assignment query
      const result = await service.getNextAssignee('house-1', 'chore-1');
      expect(result).toEqual(members[0]);
    });

    it('returns the member after the last-assigned member', async () => {
      const members = [
        { id: 'member-1', displayName: 'Alice' },
        { id: 'member-2', displayName: 'Bob' },
      ];
      mockDb.select
        .mockReturnValueOnce(makeChain(members))
        .mockReturnValueOnce(makeChain([{ memberId: 'member-1' }]));
      const result = await service.getNextAssignee('house-1', 'chore-1');
      expect(result).toEqual(members[1]); // Bob is next
    });

    it('wraps around to first member when last-assigned was the last in list', async () => {
      const members = [
        { id: 'member-1', displayName: 'Alice' },
        { id: 'member-2', displayName: 'Bob' },
      ];
      mockDb.select
        .mockReturnValueOnce(makeChain(members))
        .mockReturnValueOnce(makeChain([{ memberId: 'member-2' }]));
      const result = await service.getNextAssignee('house-1', 'chore-1');
      expect(result).toEqual(members[0]); // Wraps back to Alice
    });

    it('handles a single member (always returns the same member)', async () => {
      const members = [{ id: 'member-1', displayName: 'Alice' }];
      mockDb.select
        .mockReturnValueOnce(makeChain(members))
        .mockReturnValueOnce(makeChain([{ memberId: 'member-1' }]));
      const result = await service.getNextAssignee('house-1', 'chore-1');
      expect(result).toEqual(members[0]);
    });
  });

  // ---------------------------------------------------------------------------
  // createAssignment
  // ---------------------------------------------------------------------------
  describe('createAssignment', () => {
    it('throws when no memberId and rotation is off', async () => {
      await expect(
        service.createAssignment('house-1', { choreTypeId: 'chore-1', useRotation: false })
      ).rejects.toThrow('No member');
    });

    it('throws when rotation is on but no members exist', async () => {
      // getNextAssignee returns null (no members)
      mockDb.select.mockReturnValue(makeChain([]));
      await expect(
        service.createAssignment('house-1', { choreTypeId: 'chore-1', useRotation: true })
      ).rejects.toThrow('No member');
    });

    it('creates an assignment with an explicit memberId', async () => {
      const created = {
        id: 'a-1',
        houseId: 'house-1',
        choreTypeId: 'chore-1',
        memberId: 'member-1',
        dueDate: new Date(),
        completedAt: null,
      };
      mockDb.insert.mockReturnValue(makeChain(undefined));
      mockDb.select.mockReturnValue(makeChain([created])); // getAssignmentById
      const result = await service.createAssignment('house-1', {
        choreTypeId: 'chore-1',
        memberId: 'member-1',
        useRotation: false,
      });
      expect(result).toEqual(created);
      expect(saveDb).toHaveBeenCalled();
    });

    it('uses rotation to auto-select the next member', async () => {
      const members = [{ id: 'member-1', displayName: 'Alice' }];
      const created = {
        id: 'a-1',
        houseId: 'house-1',
        choreTypeId: 'chore-1',
        memberId: 'member-1',
        dueDate: new Date(),
        completedAt: null,
      };
      mockDb.select
        .mockReturnValueOnce(makeChain(members))   // getNextAssignee: members
        .mockReturnValueOnce(makeChain([]))         // getNextAssignee: lastAssignment
        .mockReturnValueOnce(makeChain([created])); // getAssignmentById after insert
      mockDb.insert.mockReturnValue(makeChain(undefined));

      const result = await service.createAssignment('house-1', {
        choreTypeId: 'chore-1',
        useRotation: true,
      });
      expect(result.memberId).toBe('member-1');
    });

    it('uses today as dueDate when none is provided', async () => {
      const created = { id: 'a-1', houseId: 'house-1', choreTypeId: 'c-1', memberId: 'm-1', dueDate: new Date(), completedAt: null };
      mockDb.insert.mockReturnValue(makeChain(undefined));
      mockDb.select.mockReturnValue(makeChain([created]));
      await service.createAssignment('house-1', { choreTypeId: 'c-1', memberId: 'm-1' });
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('stores createdAt on insert for correct rotation ordering', async () => {
      const before = new Date();
      const created = { id: 'a-1', houseId: 'house-1', choreTypeId: 'c-1', memberId: 'm-1', dueDate: new Date(), completedAt: null, createdAt: new Date() };
      const insertChain = makeChain(undefined);
      mockDb.insert.mockReturnValue(insertChain);
      mockDb.select.mockReturnValue(makeChain([created]));

      await service.createAssignment('house-1', { choreTypeId: 'c-1', memberId: 'm-1' });

      // values() is called on the insert chain with the record
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: expect.any(Date) })
      );
      const after = new Date();
      const insertedRecord = insertChain.values.mock.calls[0][0];
      expect(insertedRecord.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(insertedRecord.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ---------------------------------------------------------------------------
  // getAssignmentById
  // ---------------------------------------------------------------------------
  describe('getAssignmentById', () => {
    it('returns the assignment when found', async () => {
      const assignment = { id: 'a-1', houseId: 'house-1', choreTypeId: 'c-1', memberId: 'm-1' };
      mockDb.select.mockReturnValue(makeChain([assignment]));
      const result = await service.getAssignmentById('house-1', 'a-1');
      expect(result).toEqual(assignment);
    });

    it('returns null when assignment is not found', async () => {
      mockDb.select.mockReturnValue(makeChain([]));
      const result = await service.getAssignmentById('house-1', 'missing');
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // listAssignments
  // ---------------------------------------------------------------------------
  describe('listAssignments', () => {
    it('returns all assignments for a house', async () => {
      const assignments = [{ id: 'a-1' }, { id: 'a-2' }];
      mockDb.select.mockReturnValue(makeChain(assignments));
      const result = await service.listAssignments('house-1');
      expect(result).toEqual(assignments);
    });

    it('returns empty array when house has no assignments', async () => {
      mockDb.select.mockReturnValue(makeChain([]));
      const result = await service.listAssignments('house-1');
      expect(result).toEqual([]);
    });

    it('applies optional filters without throwing', async () => {
      mockDb.select.mockReturnValue(makeChain([]));
      await expect(
        service.listAssignments('house-1', {
          choreTypeId: 'chore-1',
          fromDate: '2024-01-01',
          toDate: '2024-12-31',
          includeCompleted: false,
        })
      ).resolves.not.toThrow();
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // updateAssignment
  // ---------------------------------------------------------------------------
  describe('updateAssignment', () => {
    it('returns null when the assignment does not exist', async () => {
      mockDb.select.mockReturnValue(makeChain([]));
      const result = await service.updateAssignment('house-1', 'missing', { memberId: 'm-1' });
      expect(result).toBeNull();
    });

    it('returns existing assignment unchanged when no updates are provided', async () => {
      const existing = { id: 'a-1', houseId: 'house-1', memberId: 'm-1', completedAt: null };
      mockDb.select.mockReturnValue(makeChain([existing]));
      const result = await service.updateAssignment('house-1', 'a-1', {});
      expect(result).toEqual(existing);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('updates memberId and returns the updated assignment', async () => {
      const existing = { id: 'a-1', houseId: 'house-1', memberId: 'm-1', completedAt: null };
      const updated = { ...existing, memberId: 'm-2' };
      mockDb.select
        .mockReturnValueOnce(makeChain([existing]))
        .mockReturnValueOnce(makeChain([updated]));
      mockDb.update.mockReturnValue(makeChain(undefined));

      const result = await service.updateAssignment('house-1', 'a-1', { memberId: 'm-2' });
      expect(result.memberId).toBe('m-2');
      expect(saveDb).toHaveBeenCalled();
    });

    it('updates dueDate and returns the updated assignment', async () => {
      const newDue = new Date('2025-03-01');
      const existing = { id: 'a-1', houseId: 'house-1', memberId: 'm-1', dueDate: new Date('2025-01-01'), completedAt: null };
      const updated = { ...existing, dueDate: newDue };
      mockDb.select
        .mockReturnValueOnce(makeChain([existing]))
        .mockReturnValueOnce(makeChain([updated]));
      mockDb.update.mockReturnValue(makeChain(undefined));

      const result = await service.updateAssignment('house-1', 'a-1', { dueDate: '2025-03-01' });
      expect(result.dueDate).toEqual(newDue);
      expect(saveDb).toHaveBeenCalled();
    });

    it('throws when dueDate is an invalid date string', async () => {
      const existing = { id: 'a-1', houseId: 'house-1', memberId: 'm-1', completedAt: null };
      mockDb.select.mockReturnValue(makeChain([existing]));

      await expect(
        service.updateAssignment('house-1', 'a-1', { dueDate: 'not-a-date' })
      ).rejects.toThrow('Invalid dueDate');
    });

    it('clears completedAt when passed null', async () => {
      const existing = { id: 'a-1', houseId: 'house-1', memberId: 'm-1', completedAt: new Date() };
      const updated = { ...existing, completedAt: null };
      mockDb.select
        .mockReturnValueOnce(makeChain([existing]))
        .mockReturnValueOnce(makeChain([updated]));
      mockDb.update.mockReturnValue(makeChain(undefined));

      const result = await service.updateAssignment('house-1', 'a-1', { completedAt: null });
      expect(result.completedAt).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteAssignment
  // ---------------------------------------------------------------------------
  describe('deleteAssignment', () => {
    it('returns null when the assignment does not exist', async () => {
      mockDb.select.mockReturnValue(makeChain([]));
      const result = await service.deleteAssignment('house-1', 'missing');
      expect(result).toBeNull();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('deletes the assignment and returns true', async () => {
      const existing = { id: 'a-1', houseId: 'house-1', memberId: 'm-1', completedAt: null };
      mockDb.select.mockReturnValue(makeChain([existing]));
      mockDb.delete.mockReturnValue(makeChain(undefined));

      const result = await service.deleteAssignment('house-1', 'a-1');
      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(saveDb).toHaveBeenCalled();
    });

    it('does not delete assignments from a different house (cross-house safety)', async () => {
      // Assignment exists under house-1, but we request delete from house-2
      mockDb.select.mockReturnValue(makeChain([])); // getAssignmentById scoped to house-2 finds nothing
      const result = await service.deleteAssignment('house-2', 'a-1');
      expect(result).toBeNull();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // markComplete
  // ---------------------------------------------------------------------------
  describe('markComplete', () => {
    it('sets completedAt to now on an existing assignment', async () => {
      const existing = { id: 'a-1', houseId: 'house-1', memberId: 'm-1', completedAt: null };
      const completed = { ...existing, completedAt: new Date() };
      mockDb.select
        .mockReturnValueOnce(makeChain([existing]))
        .mockReturnValueOnce(makeChain([completed]));
      mockDb.update.mockReturnValue(makeChain(undefined));

      const result = await service.markComplete('house-1', 'a-1');
      expect(result.completedAt).toBeTruthy();
    });

    it('returns null when the assignment does not exist', async () => {
      mockDb.select.mockReturnValue(makeChain([]));
      const result = await service.markComplete('house-1', 'missing');
      expect(result).toBeNull();
    });

    it('spawns a next assignment when the completed assignment has interval recurrence', async () => {
      const dueDate = new Date('2025-06-01');
      const existing = {
        id: 'a-1', houseId: 'house-1', choreTypeId: 'ct-1', memberId: 'm-1',
        dueDate, completedAt: null, recurrenceType: 'interval', recurrenceValue: 7,
      };
      const completed = { ...existing, completedAt: new Date() };
      const spawned = {
        id: 'a-2', houseId: 'house-1', choreTypeId: 'ct-1', memberId: 'm-1',
        dueDate: new Date('2025-06-08'), completedAt: null,
        recurrenceType: 'interval', recurrenceValue: 7,
      };

      mockDb.select
        .mockReturnValueOnce(makeChain([existing]))   // updateAssignment: getAssignmentById
        .mockReturnValueOnce(makeChain([completed]))  // updateAssignment: post-update fetch
        .mockReturnValueOnce(makeChain([spawned]));   // createAssignment: getAssignmentById
      mockDb.update.mockReturnValue(makeChain(undefined));
      mockDb.insert.mockReturnValue(makeChain(undefined));

      await service.markComplete('house-1', 'a-1');

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      const insertedValues = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertedValues.recurrenceType).toBe('interval');
      expect(insertedValues.recurrenceValue).toBe(7);
      expect(insertedValues.dueDate).toEqual(new Date('2025-06-08'));
    });

    it('spawns a next assignment on the correct weekday when recurrence type is weekday', async () => {
      // June 3 2025 is a Tuesday (day 2). recurrenceValue=2 means every Tuesday.
      // Next Tuesday = June 10 2025.
      const dueDate = new Date('2025-06-03');
      const existing = {
        id: 'a-1', houseId: 'house-1', choreTypeId: 'ct-1', memberId: 'm-1',
        dueDate, completedAt: null, recurrenceType: 'weekday', recurrenceValue: 2,
      };
      const completed = { ...existing, completedAt: new Date() };
      const spawned = {
        id: 'a-2', houseId: 'house-1', choreTypeId: 'ct-1', memberId: 'm-1',
        dueDate: new Date('2025-06-10'), completedAt: null,
        recurrenceType: 'weekday', recurrenceValue: 2,
      };

      mockDb.select
        .mockReturnValueOnce(makeChain([existing]))
        .mockReturnValueOnce(makeChain([completed]))
        .mockReturnValueOnce(makeChain([spawned]));
      mockDb.update.mockReturnValue(makeChain(undefined));
      mockDb.insert.mockReturnValue(makeChain(undefined));

      await service.markComplete('house-1', 'a-1');

      const insertedValues = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertedValues.dueDate.getUTCDay()).toBe(2); // Tuesday
      expect(insertedValues.dueDate.toISOString().slice(0, 10)).toBe('2025-06-10');
    });

    it('does NOT spawn a next assignment when the assignment has no recurrence', async () => {
      const existing = { id: 'a-1', houseId: 'house-1', memberId: 'm-1', completedAt: null };
      const completed = { ...existing, completedAt: new Date() };
      mockDb.select
        .mockReturnValueOnce(makeChain([existing]))
        .mockReturnValueOnce(makeChain([completed]));
      mockDb.update.mockReturnValue(makeChain(undefined));

      await service.markComplete('house-1', 'a-1');

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('carries recurrence settings forward onto the spawned assignment', async () => {
      const dueDate = new Date('2025-01-01');
      const existing = {
        id: 'a-1', houseId: 'house-1', choreTypeId: 'ct-1', memberId: 'm-1',
        dueDate, completedAt: null, recurrenceType: 'interval', recurrenceValue: 14,
      };
      const completed = { ...existing, completedAt: new Date() };
      const spawned = { id: 'a-2', ...completed };

      mockDb.select
        .mockReturnValueOnce(makeChain([existing]))
        .mockReturnValueOnce(makeChain([completed]))
        .mockReturnValueOnce(makeChain([spawned]));
      mockDb.update.mockReturnValue(makeChain(undefined));
      mockDb.insert.mockReturnValue(makeChain(undefined));

      await service.markComplete('house-1', 'a-1');

      const insertedValues = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertedValues.recurrenceType).toBe('interval');
      expect(insertedValues.recurrenceValue).toBe(14);
    });

    it('keeps the same memberId on the spawned assignment (rotation not re-run)', async () => {
      const dueDate = new Date('2025-03-01');
      const existing = {
        id: 'a-1', houseId: 'house-1', choreTypeId: 'ct-1', memberId: 'm-1',
        dueDate, completedAt: null, recurrenceType: 'interval', recurrenceValue: 7,
      };
      const completed = { ...existing, completedAt: new Date() };
      const spawned = { id: 'a-2', ...completed };

      mockDb.select
        .mockReturnValueOnce(makeChain([existing]))
        .mockReturnValueOnce(makeChain([completed]))
        .mockReturnValueOnce(makeChain([spawned]));
      mockDb.update.mockReturnValue(makeChain(undefined));
      mockDb.insert.mockReturnValue(makeChain(undefined));

      await service.markComplete('house-1', 'a-1');

      const insertedValues = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertedValues.memberId).toBe('m-1');
    });
  });

  // ---------------------------------------------------------------------------
  // nextRecurringDueDate
  // ---------------------------------------------------------------------------
  describe('nextRecurringDueDate', () => {
    it('advances by N days for interval type', () => {
      const from = new Date('2025-06-01');
      const next = service.nextRecurringDueDate(from, 'interval', 7);
      expect(next.toISOString().slice(0, 10)).toBe('2025-06-08');
    });

    it('advances by 1 day for daily interval', () => {
      const from = new Date('2025-06-01');
      const next = service.nextRecurringDueDate(from, 'interval', 1);
      expect(next.toISOString().slice(0, 10)).toBe('2025-06-02');
    });

    it('advances by 14 days for biweekly interval', () => {
      const from = new Date('2025-06-01');
      const next = service.nextRecurringDueDate(from, 'interval', 14);
      expect(next.toISOString().slice(0, 10)).toBe('2025-06-15');
    });

    it('finds the next occurrence of the same weekday (7 days later)', () => {
      // June 3 2025 is Tuesday (day 2)
      const from = new Date('2025-06-03');
      const next = service.nextRecurringDueDate(from, 'weekday', 2); // Tuesday
      expect(next.toISOString().slice(0, 10)).toBe('2025-06-10');
      expect(next.getUTCDay()).toBe(2);
    });

    it('finds the next occurrence of a different weekday', () => {
      // June 3 2025 is Tuesday. Next Thursday = June 5.
      const from = new Date('2025-06-03');
      const next = service.nextRecurringDueDate(from, 'weekday', 4); // Thursday
      expect(next.toISOString().slice(0, 10)).toBe('2025-06-05');
    });

    it('never returns the same date as fromDate for weekday type', () => {
      // Even if fromDate is already on that weekday, next must be later
      const from = new Date('2025-06-03'); // Tuesday
      const next = service.nextRecurringDueDate(from, 'weekday', 2);
      expect(next.getTime()).toBeGreaterThan(from.getTime());
    });

    it('returns null for unknown recurrence type', () => {
      const from = new Date('2025-06-01');
      const next = service.nextRecurringDueDate(from, 'unknown', 7);
      expect(next).toBeNull();
    });

    it('does not mutate the fromDate argument', () => {
      const from = new Date('2025-06-01');
      const original = from.getTime();
      service.nextRecurringDueDate(from, 'interval', 7);
      expect(from.getTime()).toBe(original);
    });
  });

  // ---------------------------------------------------------------------------
  // createAssignment — recurrence fields
  // ---------------------------------------------------------------------------
  describe('createAssignment — recurrence fields', () => {
    it('stores recurrenceType and recurrenceValue when provided', async () => {
      const created = {
        id: 'a-1', houseId: 'house-1', choreTypeId: 'c-1', memberId: 'm-1',
        dueDate: new Date(), completedAt: null,
        recurrenceType: 'interval', recurrenceValue: 7,
      };
      const insertChain = makeChain(undefined);
      mockDb.insert.mockReturnValue(insertChain);
      mockDb.select.mockReturnValue(makeChain([created]));

      await service.createAssignment('house-1', {
        choreTypeId: 'c-1', memberId: 'm-1',
        recurrenceType: 'interval', recurrenceValue: 7,
      });

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ recurrenceType: 'interval', recurrenceValue: 7 })
      );
    });

    it('stores null for recurrenceType and recurrenceValue when not provided', async () => {
      const created = {
        id: 'a-1', houseId: 'house-1', choreTypeId: 'c-1', memberId: 'm-1',
        dueDate: new Date(), completedAt: null, recurrenceType: null, recurrenceValue: null,
      };
      const insertChain = makeChain(undefined);
      mockDb.insert.mockReturnValue(insertChain);
      mockDb.select.mockReturnValue(makeChain([created]));

      await service.createAssignment('house-1', { choreTypeId: 'c-1', memberId: 'm-1' });

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ recurrenceType: null, recurrenceValue: null })
      );
    });

    it('stores weekday recurrenceType correctly', async () => {
      const created = {
        id: 'a-1', houseId: 'house-1', choreTypeId: 'c-1', memberId: 'm-1',
        dueDate: new Date(), completedAt: null,
        recurrenceType: 'weekday', recurrenceValue: 3,
      };
      const insertChain = makeChain(undefined);
      mockDb.insert.mockReturnValue(insertChain);
      mockDb.select.mockReturnValue(makeChain([created]));

      await service.createAssignment('house-1', {
        choreTypeId: 'c-1', memberId: 'm-1',
        recurrenceType: 'weekday', recurrenceValue: 3,
      });

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ recurrenceType: 'weekday', recurrenceValue: 3 })
      );
    });
  });
});
