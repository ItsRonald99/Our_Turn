import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { makeChain, createMockDb } from '../../test/helpers.js';

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn(),
  saveDb: vi.fn(),
}));

import { getDbSync, saveDb } from '../../db/client.js';
import membersRouter from '../members.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/houses/:houseId/members', membersRouter);
  return app;
}

const HOUSE_ID = 'house-1';
const BASE = `/houses/${HOUSE_ID}/members`;

describe('GET /houses/:houseId/members', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns all members for the house', async () => {
    const members = [
      { id: 'm-1', houseId: HOUSE_ID, displayName: 'Alice', userId: null },
      { id: 'm-2', houseId: HOUSE_ID, displayName: 'Bob', userId: null },
    ];
    mockDb.select.mockReturnValue(makeChain(members));

    const res = await request(createApp()).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].displayName).toBe('Alice');
  });

  it('returns empty array when no members exist', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp()).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('POST /houses/:houseId/members', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('creates and returns a new member', async () => {
    const created = { id: 'm-new', houseId: HOUSE_ID, displayName: 'Charlie', userId: null };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select.mockReturnValue(makeChain([created]));

    const res = await request(createApp()).post(BASE).send({ displayName: 'Charlie' });
    expect(res.status).toBe(201);
    expect(res.body.data.displayName).toBe('Charlie');
    expect(res.body.data.userId).toBeNull();
    expect(saveDb).toHaveBeenCalled();
  });

  it('trims whitespace from displayName', async () => {
    const created = { id: 'm-1', houseId: HOUSE_ID, displayName: 'Dave', userId: null };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select.mockReturnValue(makeChain([created]));

    const res = await request(createApp()).post(BASE).send({ displayName: '  Dave  ' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when displayName is missing', async () => {
    const res = await request(createApp()).post(BASE).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('displayName is required');
  });

  it('returns 400 when displayName is not a string', async () => {
    const res = await request(createApp()).post(BASE).send({ displayName: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('displayName is required');
  });
});

describe('PATCH /houses/:houseId/members/:memberId', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('updates and returns the member', async () => {
    const existing = { id: 'm-1', houseId: HOUSE_ID, displayName: 'Alice', userId: null };
    const updated = { ...existing, displayName: 'Alicia' };
    mockDb.select
      .mockReturnValueOnce(makeChain([existing]))
      .mockReturnValueOnce(makeChain([updated]));
    mockDb.update.mockReturnValue(makeChain(undefined));

    const res = await request(createApp())
      .patch(`${BASE}/m-1`)
      .send({ displayName: 'Alicia' });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Alicia');
    expect(saveDb).toHaveBeenCalled();
  });

  it('returns the member unchanged when no updates are provided', async () => {
    const existing = { id: 'm-1', houseId: HOUSE_ID, displayName: 'Alice', userId: null };
    mockDb.select.mockReturnValue(makeChain([existing]));

    const res = await request(createApp()).patch(`${BASE}/m-1`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Alice');
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('returns 404 when member does not exist', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp())
      .patch(`${BASE}/nonexistent`)
      .send({ displayName: 'New Name' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Member not found');
  });

  it('returns 404 when member belongs to a different house', async () => {
    const wrongHouseMember = { id: 'm-1', houseId: 'different-house', displayName: 'Alice', userId: null };
    mockDb.select.mockReturnValue(makeChain([wrongHouseMember]));

    const res = await request(createApp())
      .patch(`${BASE}/m-1`)
      .send({ displayName: 'Alicia' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /houses/:houseId/members/:memberId', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('deletes the member and returns 204', async () => {
    const existing = { id: 'm-1', houseId: HOUSE_ID, displayName: 'Alice', userId: null };
    mockDb.select.mockReturnValue(makeChain([existing]));
    mockDb.delete.mockReturnValue(makeChain(undefined));

    const res = await request(createApp()).delete(`${BASE}/m-1`);
    expect(res.status).toBe(204);
    expect(saveDb).toHaveBeenCalled();
  });

  it('returns 404 when member does not exist', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const res = await request(createApp()).delete(`${BASE}/nonexistent`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Member not found');
  });

  it('returns 404 when member belongs to a different house', async () => {
    const wrongHouseMember = { id: 'm-1', houseId: 'different-house', displayName: 'Alice', userId: null };
    mockDb.select.mockReturnValue(makeChain([wrongHouseMember]));

    const res = await request(createApp()).delete(`${BASE}/m-1`);
    expect(res.status).toBe(404);
  });
});
