import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { makeChain, createMockDb } from '../../test/helpers.js';

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn(),
  saveDb: vi.fn(),
}));

import { getDbSync } from '../../db/client.js';
import housesRouter from '../houses.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/houses', housesRouter);
  return app;
}

describe('GET /houses', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns all houses', async () => {
    const houses = [
      { id: 'house-1', name: 'Our House', createdAt: new Date() },
      { id: 'house-2', name: 'Beach House', createdAt: new Date() },
    ];
    mockDb.select.mockReturnValue(makeChain(houses));

    const res = await request(createApp()).get('/houses');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe('house-1');
    expect(res.body.data[1].id).toBe('house-2');
  });

  it('returns an empty array when no houses exist', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp()).get('/houses');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /houses/:houseId', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns the house when found', async () => {
    const house = { id: 'house-1', name: 'Our House', createdAt: new Date() };
    mockDb.select.mockReturnValue(makeChain([house]));

    const res = await request(createApp()).get('/houses/house-1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('house-1');
    expect(res.body.data.name).toBe('Our House');
  });

  it('returns 404 when house does not exist', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp()).get('/houses/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('House not found');
  });
});
