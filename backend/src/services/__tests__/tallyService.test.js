import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../db/client.js', () => ({
  saveDb: vi.fn(),
}));

import { saveDb } from '../../db/client.js';
import { makeChain, createMockDb } from '../../test/helpers.js';
import { addManualTally, removeManualTally } from '../tallyService.js';

const HOUSE_ID = 'house-1';
const MEMBER_ID = 'm-1';
const CHORE_TYPE_ID = 'ct-1';

const member = { id: MEMBER_ID, houseId: HOUSE_ID, displayName: 'Alice' };
const choreType = { id: CHORE_TYPE_ID, houseId: HOUSE_ID, name: 'Garbage' };

describe('addManualTally', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
  });

  it('inserts a +1 adjustment and returns the row', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([member]))    // member validation
      .mockReturnValueOnce(makeChain([choreType])); // choreType validation
    mockDb.insert.mockReturnValue(makeChain(undefined));

    const result = await addManualTally(mockDb, HOUSE_ID, MEMBER_ID, CHORE_TYPE_ID);

    expect(result.delta).toBe(1);
    expect(result.houseId).toBe(HOUSE_ID);
    expect(result.memberId).toBe(MEMBER_ID);
    expect(result.choreTypeId).toBe(CHORE_TYPE_ID);
    expect(result.id).toBeDefined();
  });

  it('calls saveDb after inserting', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([member]))
      .mockReturnValueOnce(makeChain([choreType]));
    mockDb.insert.mockReturnValue(makeChain(undefined));

    await addManualTally(mockDb, HOUSE_ID, MEMBER_ID, CHORE_TYPE_ID);

    expect(saveDb).toHaveBeenCalledOnce();
  });

  it('throws 404 when member not in house', async () => {
    mockDb.select.mockReturnValueOnce(makeChain([])); // member not found

    const err = await addManualTally(mockDb, HOUSE_ID, MEMBER_ID, CHORE_TYPE_ID).catch((e) => e);

    expect(err.message).toBe('Member not found');
    expect(err.status).toBe(404);
    expect(saveDb).not.toHaveBeenCalled();
  });

  it('throws 404 when chore type not in house', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([member]))   // member found
      .mockReturnValueOnce(makeChain([]));         // choreType not found

    const err = await addManualTally(mockDb, HOUSE_ID, MEMBER_ID, CHORE_TYPE_ID).catch((e) => e);

    expect(err.message).toBe('Chore type not found');
    expect(err.status).toBe(404);
    expect(saveDb).not.toHaveBeenCalled();
  });
});

describe('removeManualTally', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
  });

  it('inserts a -1 adjustment and returns the row', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([member]))    // member validation
      .mockReturnValueOnce(makeChain([choreType])) // choreType validation
      .mockReturnValueOnce(makeChain([{ completedAt: new Date() }])) // 1 completed assignment
      .mockReturnValueOnce(makeChain([]));          // no prior adjustments
    mockDb.insert.mockReturnValue(makeChain(undefined));

    const result = await removeManualTally(mockDb, HOUSE_ID, MEMBER_ID, CHORE_TYPE_ID);

    expect(result.delta).toBe(-1);
    expect(result.houseId).toBe(HOUSE_ID);
    expect(result.memberId).toBe(MEMBER_ID);
    expect(result.choreTypeId).toBe(CHORE_TYPE_ID);
  });

  it('calls saveDb after inserting', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([member]))
      .mockReturnValueOnce(makeChain([choreType]))
      .mockReturnValueOnce(makeChain([{ completedAt: new Date() }]))
      .mockReturnValueOnce(makeChain([]));
    mockDb.insert.mockReturnValue(makeChain(undefined));

    await removeManualTally(mockDb, HOUSE_ID, MEMBER_ID, CHORE_TYPE_ID);

    expect(saveDb).toHaveBeenCalledOnce();
  });

  it('throws 400 when tally is already at zero', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([member]))
      .mockReturnValueOnce(makeChain([choreType]))
      .mockReturnValueOnce(makeChain([]))  // no completions
      .mockReturnValueOnce(makeChain([])); // no adjustments → total = 0

    const err = await removeManualTally(mockDb, HOUSE_ID, MEMBER_ID, CHORE_TYPE_ID).catch((e) => e);

    expect(err.message).toBe('Tally is already at zero');
    expect(err.status).toBe(400);
    expect(saveDb).not.toHaveBeenCalled();
  });

  it('throws 400 when manual adjustments have already zeroed out completions', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([member]))
      .mockReturnValueOnce(makeChain([choreType]))
      .mockReturnValueOnce(makeChain([{ completedAt: new Date() }])) // 1 completion
      .mockReturnValueOnce(makeChain([{ delta: -1 }])); // 1 prior removal → net 0

    const err = await removeManualTally(mockDb, HOUSE_ID, MEMBER_ID, CHORE_TYPE_ID).catch((e) => e);

    expect(err.status).toBe(400);
    expect(saveDb).not.toHaveBeenCalled();
  });

  it('throws 404 when member not in house', async () => {
    mockDb.select.mockReturnValueOnce(makeChain([]));

    const err = await removeManualTally(mockDb, HOUSE_ID, MEMBER_ID, CHORE_TYPE_ID).catch((e) => e);

    expect(err.status).toBe(404);
  });
});
