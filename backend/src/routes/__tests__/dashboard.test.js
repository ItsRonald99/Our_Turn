import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../services/dashboardService.js', () => ({
  getChoreCompletionStats: vi.fn(),
}));

vi.mock('../../middleware/requireAuth.js', () => ({
  requireAuth: (_req, _res, next) => next(),
}));
vi.mock('../../middleware/requireHouseMember.js', () => ({
  requireHouseMember: (_req, _res, next) => next(),
}));

import { getChoreCompletionStats } from '../../services/dashboardService.js';
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
