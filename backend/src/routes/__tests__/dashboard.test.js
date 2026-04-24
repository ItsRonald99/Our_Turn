import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../services/dashboardService.js', () => ({
  getChoreCompletionStats: vi.fn(),
}));

vi.mock('../../services/tallyService.js', () => ({
  addManualTally: vi.fn(),
  removeManualTally: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn().mockReturnValue({}),
}));

vi.mock('../../middleware/requireAuth.js', () => ({
  requireAuth: (_req, _res, next) => next(),
}));
vi.mock('../../middleware/requireHouseMember.js', () => ({
  requireHouseMember: (_req, _res, next) => next(),
}));
vi.mock('../../middleware/requireHouseOwner.js', () => ({
  requireHouseOwner: vi.fn((_req, _res, next) => next()),
}));

import { getChoreCompletionStats } from '../../services/dashboardService.js';
import { addManualTally, removeManualTally } from '../../services/tallyService.js';
import { requireHouseOwner } from '../../middleware/requireHouseOwner.js';
import dashboardRouter from '../dashboard.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/houses/:houseId/dashboard', dashboardRouter);
  return app;
}

const HOUSE_ID = 'house-1';
const BASE = `/houses/${HOUSE_ID}/dashboard`;

const makeStats = (overrides = {}) => ({
  members: [
    { memberId: 'm-1', displayName: 'Alice', chores: { 'ct-1': 5, 'ct-2': 2 } },
    { memberId: 'm-2', displayName: 'Bob', chores: { 'ct-1': 3 } },
  ],
  choreTypes: [
    { id: 'ct-1', name: 'Garbage' },
    { id: 'ct-2', name: 'Recycling' },
  ],
  ...overrides,
});

describe('GET /houses/:houseId/dashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns dashboard stats', async () => {
    getChoreCompletionStats.mockResolvedValue(makeStats());

    const res = await request(createApp()).get(BASE);

    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(2);
    expect(res.body.data.choreTypes).toHaveLength(2);
    expect(getChoreCompletionStats).toHaveBeenCalledWith(HOUSE_ID);
  });

  it('returns correct counts per member', async () => {
    getChoreCompletionStats.mockResolvedValue(makeStats());

    const res = await request(createApp()).get(BASE);

    const alice = res.body.data.members.find((m) => m.displayName === 'Alice');
    expect(alice.chores['ct-1']).toBe(5);
    expect(alice.chores['ct-2']).toBe(2);

    const bob = res.body.data.members.find((m) => m.displayName === 'Bob');
    expect(bob.chores['ct-1']).toBe(3);
    expect(bob.chores['ct-2']).toBeUndefined();
  });

  it('handles empty house (no members, no chore types)', async () => {
    getChoreCompletionStats.mockResolvedValue({ members: [], choreTypes: [] });

    const res = await request(createApp()).get(BASE);

    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(0);
    expect(res.body.data.choreTypes).toHaveLength(0);
  });

  it('returns 500 when service throws', async () => {
    getChoreCompletionStats.mockRejectedValue(new Error('DB error'));

    const res = await request(createApp()).get(BASE);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB error');
  });
});

describe('POST /houses/:houseId/dashboard/tally/add', () => {
  const TALLY_URL = `${BASE}/tally/add`;

  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when memberId is missing', async () => {
    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ choreTypeId: 'ct-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/memberId/);
  });

  it('returns 400 when choreTypeId is missing', async () => {
    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ memberId: 'm-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/choreTypeId/);
  });

  it('returns 201 with the adjustment row on success', async () => {
    const row = { id: 'adj-1', houseId: HOUSE_ID, memberId: 'm-1', choreTypeId: 'ct-1', delta: 1 };
    addManualTally.mockResolvedValue(row);

    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ memberId: 'm-1', choreTypeId: 'ct-1' });

    expect(res.status).toBe(201);
    expect(res.body.data.delta).toBe(1);
    expect(addManualTally).toHaveBeenCalledWith({}, HOUSE_ID, 'm-1', 'ct-1');
  });

  it('returns 403 when requireHouseOwner rejects', async () => {
    requireHouseOwner.mockImplementationOnce((_req, res) => {
      res.status(403).json({ error: 'Forbidden: only the house owner can perform this action' });
    });

    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ memberId: 'm-1', choreTypeId: 'ct-1' });

    expect(res.status).toBe(403);
  });

  it('forwards status from service errors (e.g. 404)', async () => {
    const err = new Error('Member not found');
    err.status = 404;
    addManualTally.mockRejectedValue(err);

    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ memberId: 'bad-id', choreTypeId: 'ct-1' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Member not found');
  });

  it('returns 500 when service throws without a status', async () => {
    addManualTally.mockRejectedValue(new Error('Unexpected'));

    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ memberId: 'm-1', choreTypeId: 'ct-1' });

    expect(res.status).toBe(500);
  });
});

describe('POST /houses/:houseId/dashboard/tally/remove', () => {
  const TALLY_URL = `${BASE}/tally/remove`;

  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when memberId is missing', async () => {
    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ choreTypeId: 'ct-1' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when choreTypeId is missing', async () => {
    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ memberId: 'm-1' });

    expect(res.status).toBe(400);
  });

  it('returns 201 with the adjustment row on success', async () => {
    const row = { id: 'adj-2', houseId: HOUSE_ID, memberId: 'm-1', choreTypeId: 'ct-1', delta: -1 };
    removeManualTally.mockResolvedValue(row);

    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ memberId: 'm-1', choreTypeId: 'ct-1' });

    expect(res.status).toBe(201);
    expect(res.body.data.delta).toBe(-1);
    expect(removeManualTally).toHaveBeenCalledWith({}, HOUSE_ID, 'm-1', 'ct-1');
  });

  it('returns 403 when requireHouseOwner rejects', async () => {
    requireHouseOwner.mockImplementationOnce((_req, res) => {
      res.status(403).json({ error: 'Forbidden: only the house owner can perform this action' });
    });

    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ memberId: 'm-1', choreTypeId: 'ct-1' });

    expect(res.status).toBe(403);
  });

  it('forwards status from service errors (e.g. 404)', async () => {
    const err = new Error('Chore type not found');
    err.status = 404;
    removeManualTally.mockRejectedValue(err);

    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ memberId: 'm-1', choreTypeId: 'bad-id' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when service rejects because tally is already at zero', async () => {
    const err = new Error('Tally is already at zero');
    err.status = 400;
    removeManualTally.mockRejectedValue(err);

    const res = await request(createApp())
      .post(TALLY_URL)
      .send({ memberId: 'm-1', choreTypeId: 'ct-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Tally is already at zero');
  });
});
