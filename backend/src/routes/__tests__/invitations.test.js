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

import { getDbSync, saveDb } from '../../db/client.js';
import invitationsRouter from '../invitations.js';

function createApp(userId = 'user-1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId, email: 'user@test.com' };
    next();
  });
  app.use('/invitations', invitationsRouter);
  return app;
}

describe('GET /invitations', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns pending invitations enriched with house and inviter names', async () => {
    const inv = {
      id: 'inv-1', houseId: 'h-1', inviterUserId: 'alice-id',
      inviteeUserId: 'user-1', status: 'pending', createdAt: new Date(),
    };
    mockDb.select
      .mockReturnValueOnce(makeChain([inv]))                          // pending invitations
      .mockReturnValueOnce(makeChain([{ name: 'The Blue House' }]))  // house name
      .mockReturnValueOnce(makeChain([{ displayName: 'Alice' }]));   // inviter name

    const res = await request(createApp('user-1')).get('/invitations');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('inv-1');
    expect(res.body.data[0].houseName).toBe('The Blue House');
    expect(res.body.data[0].inviterName).toBe('Alice');
  });

  it('returns empty array when there are no pending invitations', async () => {
    mockDb.select.mockReturnValueOnce(makeChain([]));
    const res = await request(createApp()).get('/invitations');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('falls back to "Unknown" names when house or inviter is missing', async () => {
    const inv = {
      id: 'inv-1', houseId: 'deleted-house', inviterUserId: 'deleted-user',
      inviteeUserId: 'user-1', status: 'pending', createdAt: new Date(),
    };
    mockDb.select
      .mockReturnValueOnce(makeChain([inv]))
      .mockReturnValueOnce(makeChain([]))   // house not found
      .mockReturnValueOnce(makeChain([]));  // inviter not found

    const res = await request(createApp('user-1')).get('/invitations');
    expect(res.status).toBe(200);
    expect(res.body.data[0].houseName).toBe('Unknown house');
    expect(res.body.data[0].inviterName).toBe('Unknown user');
  });
});

describe('POST /invitations/:id/respond', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('accepts an invitation and creates a household member', async () => {
    const inv = { id: 'inv-1', houseId: 'h-1', inviterUserId: 'alice-id', inviteeUserId: 'user-1', status: 'pending' };
    const invitee = { id: 'user-1', displayName: 'Bob', email: 'bob@test.com' };
    const updated = { ...inv, status: 'accepted' };
    mockDb.select
      .mockReturnValueOnce(makeChain([inv]))       // find invitation
      .mockReturnValueOnce(makeChain([]))           // no existing member
      .mockReturnValueOnce(makeChain([invitee]))    // get user for displayName
      .mockReturnValueOnce(makeChain([updated]));   // fetch updated invitation
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.update.mockReturnValue(makeChain(undefined));

    const res = await request(createApp('user-1'))
      .post('/invitations/inv-1/respond')
      .send({ action: 'accept' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('accepted');
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(saveDb).toHaveBeenCalledTimes(1);
  });

  it('declines an invitation without creating a member', async () => {
    const inv = { id: 'inv-1', houseId: 'h-1', inviteeUserId: 'user-1', status: 'pending' };
    const updated = { ...inv, status: 'declined' };
    mockDb.select
      .mockReturnValueOnce(makeChain([inv]))
      .mockReturnValueOnce(makeChain([updated]));
    mockDb.update.mockReturnValue(makeChain(undefined));

    const res = await request(createApp('user-1'))
      .post('/invitations/inv-1/respond')
      .send({ action: 'decline' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('declined');
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(saveDb).toHaveBeenCalledTimes(1);
  });

  it('does not insert a duplicate member when user already joined via invite code', async () => {
    const inv = { id: 'inv-1', houseId: 'h-1', inviteeUserId: 'user-1', status: 'pending' };
    const member = { id: 'm-1', houseId: 'h-1', userId: 'user-1' };
    const updated = { ...inv, status: 'accepted' };
    mockDb.select
      .mockReturnValueOnce(makeChain([inv]))
      .mockReturnValueOnce(makeChain([member]))   // already a member
      .mockReturnValueOnce(makeChain([updated]));
    mockDb.update.mockReturnValue(makeChain(undefined));

    const res = await request(createApp('user-1'))
      .post('/invitations/inv-1/respond')
      .send({ action: 'accept' });

    expect(res.status).toBe(200);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(saveDb).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for an invalid action value', async () => {
    const res = await request(createApp())
      .post('/invitations/inv-1/respond')
      .send({ action: 'maybe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/accept.*decline/i);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns 400 when action is missing', async () => {
    const res = await request(createApp())
      .post('/invitations/inv-1/respond')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when the invitation does not exist', async () => {
    mockDb.select.mockReturnValueOnce(makeChain([]));
    const res = await request(createApp())
      .post('/invitations/nope/respond')
      .send({ action: 'accept' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Invitation not found');
  });

  it('returns 403 when the invitation belongs to a different user', async () => {
    const inv = { id: 'inv-1', houseId: 'h-1', inviteeUserId: 'someone-else', status: 'pending' };
    mockDb.select.mockReturnValueOnce(makeChain([inv]));
    const res = await request(createApp('user-1'))
      .post('/invitations/inv-1/respond')
      .send({ action: 'accept' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not your invitation');
  });

  it('returns 409 when the invitation has already been responded to', async () => {
    const inv = { id: 'inv-1', houseId: 'h-1', inviteeUserId: 'user-1', status: 'accepted' };
    mockDb.select.mockReturnValueOnce(makeChain([inv]));
    const res = await request(createApp('user-1'))
      .post('/invitations/inv-1/respond')
      .send({ action: 'accept' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Invitation has already been responded to');
  });

  it('does not call saveDb when early validation fails', async () => {
    mockDb.select.mockReturnValueOnce(makeChain([]));
    await request(createApp()).post('/invitations/nope/respond').send({ action: 'accept' });
    expect(saveDb).not.toHaveBeenCalled();
  });
});
