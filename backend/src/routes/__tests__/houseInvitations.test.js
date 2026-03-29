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

import { getDbSync, saveDb } from '../../db/client.js';
import houseInvitationsRouter from '../houseInvitations.js';

function createApp(userId = 'inviter-id') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId, email: 'inviter@test.com' };
    next();
  });
  app.use('/houses/:houseId/invitations', houseInvitationsRouter);
  return app;
}

describe('POST /houses/:houseId/invitations', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('creates an invitation for a valid email', async () => {
    const invitee = { id: 'invitee-id', email: 'bob@test.com', displayName: 'Bob' };
    const invitation = {
      id: 'inv-1', houseId: 'h-1',
      inviterUserId: 'inviter-id', inviteeUserId: 'invitee-id',
      status: 'pending', createdAt: new Date(),
    };
    mockDb.select
      .mockReturnValueOnce(makeChain([invitee]))        // resolve user by email
      .mockReturnValueOnce(makeChain([]))               // not already a member
      .mockReturnValueOnce(makeChain([]))               // no pending invite
      .mockReturnValueOnce(makeChain([invitation]));    // fetch created row
    mockDb.insert.mockReturnValue(makeChain(undefined));

    const res = await request(createApp())
      .post('/houses/h-1/invitations')
      .send({ email: 'bob@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.inviteeUserId).toBe('invitee-id');
    expect(saveDb).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(createApp())
      .post('/houses/h-1/invitations')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('email is required');
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns 400 when email is blank', async () => {
    const res = await request(createApp())
      .post('/houses/h-1/invitations')
      .send({ email: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('email is required');
  });

  it('returns 404 when no user has that email', async () => {
    mockDb.select.mockReturnValueOnce(makeChain([]));
    const res = await request(createApp())
      .post('/houses/h-1/invitations')
      .send({ email: 'nobody@test.com' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('No user found with that email');
  });

  it('returns 400 when inviting yourself', async () => {
    const self = { id: 'inviter-id', email: 'inviter@test.com', displayName: 'Me' };
    mockDb.select.mockReturnValueOnce(makeChain([self]));
    const res = await request(createApp('inviter-id'))
      .post('/houses/h-1/invitations')
      .send({ email: 'inviter@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You cannot invite yourself');
  });

  it('returns 409 when invitee is already a house member', async () => {
    const invitee = { id: 'invitee-id', email: 'bob@test.com', displayName: 'Bob' };
    const member = { id: 'm-1', houseId: 'h-1', userId: 'invitee-id' };
    mockDb.select
      .mockReturnValueOnce(makeChain([invitee]))
      .mockReturnValueOnce(makeChain([member]));
    const res = await request(createApp())
      .post('/houses/h-1/invitations')
      .send({ email: 'bob@test.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('User is already a member of this house');
  });

  it('returns 409 when a pending invitation already exists', async () => {
    const invitee = { id: 'invitee-id', email: 'bob@test.com', displayName: 'Bob' };
    const existingInv = { id: 'inv-old', status: 'pending' };
    mockDb.select
      .mockReturnValueOnce(makeChain([invitee]))
      .mockReturnValueOnce(makeChain([]))              // not a member
      .mockReturnValueOnce(makeChain([existingInv]));  // pending invite exists
    const res = await request(createApp())
      .post('/houses/h-1/invitations')
      .send({ email: 'bob@test.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('A pending invitation already exists for this user');
  });

  it('does not call saveDb when validation fails', async () => {
    mockDb.select.mockReturnValueOnce(makeChain([])); // user not found
    await request(createApp())
      .post('/houses/h-1/invitations')
      .send({ email: 'ghost@test.com' });
    expect(saveDb).not.toHaveBeenCalled();
  });
});
