import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn(),
}));

import { getDbSync } from '../../db/client.js';
import { makeChain, createMockDb } from '../../test/helpers.js';
import { getChoreCompletionStats } from '../dashboardService.js';

const HOUSE_ID = 'house-1';

const members = [
  { id: 'm-1', houseId: HOUSE_ID, displayName: 'Alice' },
  { id: 'm-2', houseId: HOUSE_ID, displayName: 'Bob' },
];

const types = [
  { id: 'ct-1', houseId: HOUSE_ID, name: 'Garbage' },
  { id: 'ct-2', houseId: HOUSE_ID, name: 'Recycling' },
];

function makeAssignment(memberId, choreTypeId) {
  return { houseId: HOUSE_ID, memberId, choreTypeId, completedAt: new Date() };
}

describe('getChoreCompletionStats', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns correct counts per member per chore type', async () => {
    const completed = [
      makeAssignment('m-1', 'ct-1'),
      makeAssignment('m-1', 'ct-1'),
      makeAssignment('m-1', 'ct-2'),
      makeAssignment('m-2', 'ct-1'),
    ];
    mockDb.select
      .mockReturnValueOnce(makeChain(members))
      .mockReturnValueOnce(makeChain(types))
      .mockReturnValueOnce(makeChain(completed))
      .mockReturnValueOnce(makeChain([])); // no manual adjustments

    const result = await getChoreCompletionStats(HOUSE_ID);

    const alice = result.members.find((m) => m.memberId === 'm-1');
    expect(alice.chores['ct-1']).toBe(2);
    expect(alice.chores['ct-2']).toBe(1);

    const bob = result.members.find((m) => m.memberId === 'm-2');
    expect(bob.chores['ct-1']).toBe(1);
    expect(bob.chores['ct-2']).toBeUndefined();
  });

  it('adds manual adjustment deltas to auto-completion counts', async () => {
    const completed = [makeAssignment('m-1', 'ct-1')];
    const adjustments = [
      { memberId: 'm-1', choreTypeId: 'ct-1', delta: 1 },  // +1 on top of 1 auto = 2
      { memberId: 'm-2', choreTypeId: 'ct-2', delta: -1 }, // manual-only, net -1
    ];
    mockDb.select
      .mockReturnValueOnce(makeChain(members))
      .mockReturnValueOnce(makeChain(types))
      .mockReturnValueOnce(makeChain(completed))
      .mockReturnValueOnce(makeChain(adjustments));

    const result = await getChoreCompletionStats(HOUSE_ID);

    const alice = result.members.find((m) => m.memberId === 'm-1');
    expect(alice.chores['ct-1']).toBe(2); // 1 auto + 1 manual
    const bob = result.members.find((m) => m.memberId === 'm-2');
    expect(bob.chores['ct-2']).toBe(0); // 0 auto + (-1) manual, clamped to 0
  });

  it('clamps negative adjusted counts to 0 in output', async () => {
    const adjustments = [{ memberId: 'm-1', choreTypeId: 'ct-1', delta: -1 }];
    mockDb.select
      .mockReturnValueOnce(makeChain(members))
      .mockReturnValueOnce(makeChain(types))
      .mockReturnValueOnce(makeChain([]))       // no completions
      .mockReturnValueOnce(makeChain(adjustments));

    const result = await getChoreCompletionStats(HOUSE_ID);

    const alice = result.members.find((m) => m.memberId === 'm-1');
    expect(alice.chores['ct-1']).toBe(0);
  });

  it('handles multiple chore types with zero completions gracefully', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain(members))
      .mockReturnValueOnce(makeChain(types))
      .mockReturnValueOnce(makeChain([])) // no completions
      .mockReturnValueOnce(makeChain([])); // no adjustments

    const result = await getChoreCompletionStats(HOUSE_ID);

    expect(result.choreTypes).toHaveLength(2);
    for (const m of result.members) {
      expect(m.chores).toEqual({});
    }
  });

  it('only counts completed assignments (completedAt is set)', async () => {
    const completed = [makeAssignment('m-1', 'ct-1')];
    mockDb.select
      .mockReturnValueOnce(makeChain(members))
      .mockReturnValueOnce(makeChain(types))
      .mockReturnValueOnce(makeChain(completed))
      .mockReturnValueOnce(makeChain([]));

    const result = await getChoreCompletionStats(HOUSE_ID);

    const alice = result.members.find((m) => m.memberId === 'm-1');
    expect(alice.chores['ct-1']).toBe(1);
    expect(mockDb.select).toHaveBeenCalledTimes(4);
  });

  it('scopes data to the given houseId', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain(members))
      .mockReturnValueOnce(makeChain(types))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]));

    await getChoreCompletionStats(HOUSE_ID);

    expect(mockDb.select).toHaveBeenCalledTimes(4);
    const firstChain = mockDb.select.mock.results[0].value;
    expect(firstChain.where).toHaveBeenCalled();
  });

  it('returns correct choreTypes list', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain(members))
      .mockReturnValueOnce(makeChain(types))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]));

    const result = await getChoreCompletionStats(HOUSE_ID);

    expect(result.choreTypes).toEqual([
      { id: 'ct-1', name: 'Garbage' },
      { id: 'ct-2', name: 'Recycling' },
    ]);
  });

  it('returns empty result when house has no members or types', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]));

    const result = await getChoreCompletionStats(HOUSE_ID);

    expect(result.members).toEqual([]);
    expect(result.choreTypes).toEqual([]);
  });
});
