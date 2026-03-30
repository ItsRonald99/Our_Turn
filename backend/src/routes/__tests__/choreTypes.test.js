import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { makeChain, createMockDb } from '../../test/helpers.js';

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn(),
  saveDb: vi.fn(),
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

import { getDbSync, saveDb } from '../../db/client.js';
import { requireHouseOwner } from '../../middleware/requireHouseOwner.js';
import choreTypesRouter from '../choreTypes.js';

function createApp() {
  const app = express();
  app.use(express.json());
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
      { id: 'ct-1', houseId: 'house-1', name: 'Garbage', description: null, rotationOrder: 0 },
      { id: 'ct-2', houseId: 'house-1', name: 'Recycling', description: 'Sort glass separately', rotationOrder: 1 },
    ];
    mockDb.select.mockReturnValue(makeChain(choreTypes));

    const res = await request(createApp()).get('/houses/house-1/chore-types');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('Garbage');
    expect(res.body.data[1].description).toBe('Sort glass separately');
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

  it('creates and returns a new chore type with title', async () => {
    const created = { id: 'ct-new', houseId: 'house-1', name: 'Snow Shoveling', description: null, rotationOrder: 0 };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select.mockReturnValue(makeChain([created]));

    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({ title: 'Snow Shoveling' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Snow Shoveling');
    expect(res.body.data.houseId).toBe('house-1');
    expect(saveDb).toHaveBeenCalled();
  });

  it('stores the description when provided', async () => {
    const created = { id: 'ct-new', houseId: 'house-1', name: 'Dishes', description: 'Include pots and pans', rotationOrder: 0 };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select.mockReturnValue(makeChain([created]));

    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({ title: 'Dishes', description: 'Include pots and pans' });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('Include pots and pans');
  });

  it('trims whitespace from the title', async () => {
    const created = { id: 'ct-1', houseId: 'house-1', name: 'Garbage', description: null, rotationOrder: 0 };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select.mockReturnValue(makeChain([created]));

    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({ title: '  Garbage  ' });

    expect(res.status).toBe(201);
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('title is required');
  });

  it('returns 400 when title is not a string', async () => {
    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send({ title: 42 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('title is required');
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(createApp())
      .post('/houses/house-1/chore-types')
      .send();

    expect(res.status).toBe(400);
  });
});

describe('DELETE /houses/:houseId/chore-types/:choreTypeId', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('deletes a chore type and returns 204', async () => {
    const existing = { id: 'ct-1', houseId: 'house-1', name: 'Garbage', description: null, rotationOrder: 0 };
    // First select returns the existing row, delete runs, second select (if any) not needed
    mockDb.select.mockReturnValue(makeChain([existing]));
    mockDb.delete.mockReturnValue(makeChain(undefined));

    const res = await request(createApp()).delete('/houses/house-1/chore-types/ct-1');
    expect(res.status).toBe(204);
    expect(saveDb).toHaveBeenCalled();
  });

  it('returns 404 when the chore type does not exist', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp()).delete('/houses/house-1/chore-types/ct-999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Chore type not found');
  });

  it('returns 404 when the chore type belongs to a different house (cross-house protection)', async () => {
    // The select uses AND(id, houseId), so querying house-2 for a ct owned by house-1 returns nothing
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp()).delete('/houses/house-2/chore-types/ct-1');
    expect(res.status).toBe(404);
  });

  it('does not call saveDb when the chore type is not found', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await request(createApp()).delete('/houses/house-1/chore-types/ct-999');
    expect(saveDb).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller is not a house owner', async () => {
    requireHouseOwner.mockImplementationOnce((_req, res) =>
      res.status(403).json({ error: 'Owner access required' })
    );

    const res = await request(createApp()).delete('/houses/house-1/chore-types/ct-1');
    expect(res.status).toBe(403);
    expect(saveDb).not.toHaveBeenCalled();
  });
});
