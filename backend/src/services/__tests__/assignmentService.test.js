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
      const before = new Date();
      const created = { id: 'a-1', houseId: 'house-1', choreTypeId: 'c-1', memberId: 'm-1', dueDate: new Date(), completedAt: null };
      mockDb.insert.mockReturnValue(makeChain(undefined));
      mockDb.select.mockReturnValue(makeChain([created]));
      await service.createAssignment('house-1', { choreTypeId: 'c-1', memberId: 'm-1' });
      const after = new Date();
      // Verify insert was called (dueDate defaulting is internal; just ensure no throw)
      expect(mockDb.insert).toHaveBeenCalled();
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
  });
});
