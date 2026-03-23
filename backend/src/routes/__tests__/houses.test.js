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

import { getDbSync } from '../../db/client.js';
import housesRouter from '../houses.js';

function createApp() {
  const app = express();
  app.use(express.json());
  // Seed req.user so route handlers that read it work in tests
  app.use((req, _res, next) => {
    req.user = { userId: 'test-user-id', email: 'test@test.com' };
    next();
  });
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

  it('returns the user houses (via membership filter)', async () => {
    const memberships = [{ houseId: 'house-1' }];
    const houses = [{ id: 'house-1', name: 'Our House', createdAt: new Date(), inviteCode: 'ABC123' }];
    mockDb.select
      .mockReturnValueOnce(makeChain(memberships))  // household_members query
      .mockReturnValueOnce(makeChain(houses));       // houses inArray query

    const res = await request(createApp()).get('/houses');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('house-1');
  });

  it('returns empty array when user has no houses', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp()).get('/houses');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('POST /houses', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('creates a house and auto-joins the creator', async () => {
    const house = { id: 'h-new', name: 'My House', inviteCode: 'XYZ789', createdAt: new Date() };
    const member = { id: 'm-new', houseId: 'h-new', displayName: 'test@test.com', userId: 'u-1' };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select
      .mockReturnValueOnce(makeChain([house]))   // fetch house
      .mockReturnValueOnce(makeChain([member])); // fetch member

    const res = await request(createApp())
      .post('/houses')
      .send({ name: 'My House' });

    expect(res.status).toBe(201);
    expect(res.body.data.house.name).toBe('My House');
    expect(res.body.data.member).toBeDefined();
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(createApp()).post('/houses').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });
});

describe('POST /houses/join', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('joins house with a valid invite code', async () => {
    const house = { id: 'h-1', name: 'Our House', inviteCode: 'ABC123', createdAt: new Date() };
    const member = { id: 'm-new', houseId: 'h-1', displayName: 'test@test.com', userId: 'u-1' };
    mockDb.select
      .mockReturnValueOnce(makeChain([house]))   // find house by invite code
      .mockReturnValueOnce(makeChain([]))        // existing membership check
      .mockReturnValueOnce(makeChain([member])); // fetch created member
    mockDb.insert.mockReturnValue(makeChain(undefined));

    const res = await request(createApp())
      .post('/houses/join')
      .send({ inviteCode: 'ABC123' });

    expect(res.status).toBe(201);
    expect(res.body.data.house.id).toBe('h-1');
  });

  it('returns 404 for invalid invite code', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp())
      .post('/houses/join')
      .send({ inviteCode: 'NOPE00' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Invalid invite code');
  });

  it('returns 400 when inviteCode is missing', async () => {
    const res = await request(createApp()).post('/houses/join').send({});
    expect(res.status).toBe(400);
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
    const house = { id: 'house-1', name: 'Our House', createdAt: new Date(), inviteCode: 'ABC123' };
    mockDb.select.mockReturnValue(makeChain([house]));

    const res = await request(createApp()).get('/houses/house-1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('house-1');
  });

  it('returns 404 when house does not exist', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp()).get('/houses/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('House not found');
  });
});

import { saveDb } from '../../db/client.js';

describe('DELETE /houses/:houseId', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns 204 on successful delete', async () => {
    mockDb.delete.mockReturnValue(makeChain(undefined));

    const res = await request(createApp()).delete('/houses/house-1');
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('calls db.delete with the correct houseId', async () => {
    mockDb.delete.mockReturnValue(makeChain(undefined));

    await request(createApp()).delete('/houses/house-1');

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    // The chain's where() receives the eq condition — verify delete was invoked
    const chain = mockDb.delete.mock.results[0].value;
    expect(chain.where).toHaveBeenCalledTimes(1);
  });

  it('calls saveDb after delete', async () => {
    mockDb.delete.mockReturnValue(makeChain(undefined));

    await request(createApp()).delete('/houses/house-1');

    expect(saveDb).toHaveBeenCalledTimes(1);
  });

  it('does not call saveDb when the delete throws', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn(() => Promise.reject(new Error('DB error'))),
    });

    const res = await request(createApp()).delete('/houses/house-1');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB error');
    expect(saveDb).not.toHaveBeenCalled();
  });

  it('returns 500 with error message on DB failure', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn(() => Promise.reject(new Error('Unexpected DB error'))),
    });

    const res = await request(createApp()).delete('/houses/house-1');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Unexpected DB error');
  });

  it('response body is empty on success (204 No Content)', async () => {
    mockDb.delete.mockReturnValue(makeChain(undefined));

    const res = await request(createApp()).delete('/houses/house-1');

    expect(res.status).toBe(204);
    // supertest parses empty body as empty string, not JSON
    expect(res.text).toBe('');
  });
});
