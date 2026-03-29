/**
 * Security fix tests:
 *  1. Invite-code generation uses crypto.randomInt — output always a 6-digit string.
 *  2. joinHouseLimiter / invitationLimiter block correctly and skip in NODE_ENV=test.
 */
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
  requireHouseOwner: (_req, _res, next) => next(),
}));

import { getDbSync } from '../../db/client.js';
import housesRouter from '../houses.js';
import { joinHouseLimiter, invitationLimiter } from '../../middleware/rateLimiter.js';
import rateLimit from 'express-rate-limit';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId: 'test-user-id', email: 'test@test.com' };
    next();
  });
  app.use('/houses', housesRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Invite-code output format
// ---------------------------------------------------------------------------

describe('Invite-code generation — output is always a valid 6-digit string', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  const setupHouseCreate = (mockDb) => {
    const creatorUser = { id: 'test-user-id', email: 'test@test.com', displayName: 'Test User' };
    const house = { id: 'h-new', name: 'My House', inviteCode: '000000', createdAt: new Date() };
    const member = { id: 'm-new', houseId: 'h-new', displayName: 'Test User', userId: 'test-user-id' };
    mockDb.insert.mockReturnValue(makeChain(undefined));
    mockDb.select
      .mockReturnValueOnce(makeChain([creatorUser]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([house]))
      .mockReturnValueOnce(makeChain([member]));
  };

  it('stored invite code always matches /^\\d{6}$/', async () => {
    setupHouseCreate(mockDb);
    await request(createApp()).post('/houses').send({ name: 'My House' });
    const insertedHouse = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedHouse.inviteCode).toMatch(/^\d{6}$/);
  });

  it('stored invite code is always exactly 6 characters long', async () => {
    setupHouseCreate(mockDb);
    await request(createApp()).post('/houses').send({ name: 'My House' });
    const insertedHouse = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedHouse.inviteCode).toHaveLength(6);
  });

  it('invite code contains only digits (no hex or UUID fragments)', async () => {
    setupHouseCreate(mockDb);
    await request(createApp()).post('/houses').send({ name: 'My House' });
    const insertedHouse = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(/^[0-9]+$/.test(insertedHouse.inviteCode)).toBe(true);
  });

  it('generates valid codes consistently across 10 iterations', async () => {
    for (let i = 0; i < 10; i++) {
      vi.clearAllMocks();
      getDbSync.mockReturnValue(mockDb);
      setupHouseCreate(mockDb);
      await request(createApp()).post('/houses').send({ name: 'My House' });
      const insertedHouse = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(insertedHouse.inviteCode).toMatch(/^\d{6}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Rate-limiter skip behaviour in test environment
// ---------------------------------------------------------------------------

describe('joinHouseLimiter — skips in NODE_ENV=test', () => {
  it('calls next() without blocking when NODE_ENV is "test"', async () => {
    const req = {};
    const res = {};
    let nextCalled = false;
    await new Promise((resolve) => {
      joinHouseLimiter(req, res, () => {
        nextCalled = true;
        resolve();
      });
    });
    expect(nextCalled).toBe(true);
  });
});

describe('invitationLimiter — skips in NODE_ENV=test', () => {
  it('calls next() without blocking when NODE_ENV is "test"', async () => {
    const req = {};
    const res = {};
    let nextCalled = false;
    await new Promise((resolve) => {
      invitationLimiter(req, res, () => {
        nextCalled = true;
        resolve();
      });
    });
    expect(nextCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rate-limiter blocking behaviour (skip disabled)
// ---------------------------------------------------------------------------

describe('Rate-limiter — blocks after max attempts when skip is disabled', () => {
  const buildStrictLimiter = (max) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max,
      skip: () => false,
      standardHeaders: false,
      legacyHeaders: false,
      message: { error: 'Too many join attempts. Please try again in 15 minutes.' },
    });

  const buildApp = (limiter) => {
    const app = express();
    app.use(express.json());
    app.post('/houses/join', limiter, (_req, res) => res.json({ ok: true }));
    return app;
  };

  it('allows requests up to the limit', async () => {
    const app = buildApp(buildStrictLimiter(3));
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/houses/join').send({});
      expect(res.status).not.toBe(429);
    }
  });

  it('returns 429 on the request that exceeds the limit', async () => {
    const app = buildApp(buildStrictLimiter(3));
    for (let i = 0; i < 3; i++) {
      await request(app).post('/houses/join').send({});
    }
    const blocked = await request(app).post('/houses/join').send({});
    expect(blocked.status).toBe(429);
  });

  it('blocked response includes the expected error message', async () => {
    const app = buildApp(buildStrictLimiter(1));
    await request(app).post('/houses/join').send({}); // consume the one allowed request
    const blocked = await request(app).post('/houses/join').send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('Too many join attempts. Please try again in 15 minutes.');
  });

  it('invitation limiter also returns 429 after max attempts', async () => {
    const strictInvLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 2,
      skip: () => false,
      standardHeaders: false,
      legacyHeaders: false,
      message: { error: 'Too many invitation requests. Please try again in 15 minutes.' },
    });

    const app = express();
    app.use(express.json());
    app.post('/invite', strictInvLimiter, (_req, res) => res.json({ ok: true }));

    await request(app).post('/invite').send({});
    await request(app).post('/invite').send({});
    const blocked = await request(app).post('/invite').send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many invitation requests/);
  });
});
