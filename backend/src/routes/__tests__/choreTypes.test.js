import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { makeChain, createMockDb } from '../../test/helpers.js';

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn(),
  saveDb: vi.fn(),
}));

// Bypass auth middleware in route unit tests
vi.mock('../../middleware/requireAuth.js', () => ({
  requireAuth: (_req, _res, next) => next(),
}));
vi.mock('../../middleware/requireHouseMember.js', () => ({
  requireHouseMember: (_req, _res, next) => next(),
}));

import { getDbSync, saveDb } from '../../db/client.js';
import choreTypesRouter from '../choreTypes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  // mergeParams must be true on the router; mount with :houseId so params flow through
  app.use('/houses/:houseId/chore-types', choreTypesRouter);
  return app;
}

describe('GET /houses/:houseId/chore-types', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns chore types for the house', async () => {
    const choreTypes = [
      { id: 'ct-1', houseId: 'house-1', name: 'Garbage', rotationOrder: 0 },
      { id: 'ct-2', houseId: 'house-1', name: 'Recycling', rotationOrder: 1 },
    ];
    mockDb.select.mockReturnValue(makeChain(choreTypes));

    const res = await request(createApp()).get('/houses/house-1/chore-types');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('Garbage');
  });

  it('returns an empty array when no chore types exist', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp()).get('/houses/house-1/chore-types');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('POST /houses/:houseId/chore-types', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('creates and returns a new chore type', async () => {
    const created = { id: 'ct-new', houseId: 'house-1', name: 'Snow Shoveling', rotationOrder: 0 };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select.mockReturnValue(makeChain([created]));

    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({ name: 'Snow Shoveling' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Snow Shoveling');
    expect(res.body.data.houseId).toBe('house-1');
    expect(saveDb).toHaveBeenCalled();
  });

  it('trims whitespace from the name', async () => {
    const created = { id: 'ct-1', houseId: 'house-1', name: 'Garbage', rotationOrder: 0 };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select.mockReturnValue(makeChain([created]));

    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({ name: '  Garbage  ' });

    expect(res.status).toBe(201);
  });

  it('uses the provided rotationOrder', async () => {
    const created = { id: 'ct-1', houseId: 'house-1', name: 'Recycling', rotationOrder: 2 };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select.mockReturnValue(makeChain([created]));

    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({ name: 'Recycling', rotationOrder: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.rotationOrder).toBe(2);
  });

  it('defaults rotationOrder to 0 when not provided', async () => {
    const created = { id: 'ct-1', houseId: 'house-1', name: 'Dishes', rotationOrder: 0 };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select.mockReturnValue(makeChain([created]));

    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({ name: 'Dishes' });

    expect(res.status).toBe(201);
    expect(res.body.data.rotationOrder).toBe(0);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });

  it('returns 400 when name is not a string', async () => {
    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({ name: 42 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send();

    expect(res.status).toBe(400);
  });
});
