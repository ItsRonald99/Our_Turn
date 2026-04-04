import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn(),
  saveDb: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (pwd) => `hashed:${pwd}`),
    compare: vi.fn(async (plain, hash) => hash === `hashed:${plain}`),
  },
}));

import { getDbSync, saveDb } from '../../db/client.js';
import { makeChain, createMockDb } from '../../test/helpers.js';
import * as authService from '../authService.js';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-for-auth-service';

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'alice@example.com',
  passwordHash: 'hashed:password123',
  displayName: 'Alice',
  createdAt: new Date(),
  ...overrides,
});

describe('authService.register', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('creates a user, saves, and returns user + tokens', async () => {
    const user = makeUser();
    mockDb.select
      .mockReturnValueOnce(makeChain([]))       // duplicate email check
      .mockReturnValueOnce(makeChain([user]));  // fetch created user
    mockDb.insert.mockReturnValue(makeChain(undefined));

    const result = await authService.register('Alice@Example.com', 'password123', 'Alice');

    expect(mockDb.insert).toHaveBeenCalledTimes(2); // users + refreshTokens
    expect(saveDb).toHaveBeenCalled();
    expect(result.user.email).toBe('alice@example.com');
    expect(result.user.passwordHash).toBeUndefined();
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
  });

  it('normalises email to lowercase', async () => {
    const user = makeUser({ email: 'alice@example.com' });
    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([user]));
    mockDb.insert.mockReturnValue(makeChain(undefined));

    const result = await authService.register('ALICE@EXAMPLE.COM', 'password123', 'Alice');
    expect(result.user.email).toBe('alice@example.com');
  });

  it('throws EMAIL_EXISTS when email is already taken', async () => {
    mockDb.select.mockReturnValue(makeChain([makeUser()]));

    await expect(authService.register('alice@example.com', 'password123', 'Alice'))
      .rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
  });

  it('strips passwordHash from returned user', async () => {
    const user = makeUser();
    mockDb.select.mockReturnValueOnce(makeChain([])).mockReturnValueOnce(makeChain([user]));
    mockDb.insert.mockReturnValue(makeChain(undefined));

    const result = await authService.register('alice@example.com', 'password123', 'Alice');
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});

describe('authService.login', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns user and tokens on valid credentials', async () => {
    const user = makeUser();
    mockDb.select.mockReturnValue(makeChain([user]));
    mockDb.insert.mockReturnValue(makeChain(undefined));

    const result = await authService.login('alice@example.com', 'password123');
    expect(result.user.id).toBe('user-1');
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
  });

  it('throws INVALID_CREDENTIALS when user not found', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await expect(authService.login('nobody@example.com', 'pass'))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('throws INVALID_CREDENTIALS when password is wrong', async () => {
    const user = makeUser();
    mockDb.select.mockReturnValue(makeChain([user]));

    await expect(authService.login('alice@example.com', 'wrongpassword'))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});

describe('authService.logout', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('deletes the refresh token and saves', async () => {
    mockDb.delete.mockReturnValue(makeChain(undefined));

    await authService.logout('some-token');
    expect(mockDb.delete).toHaveBeenCalled();
    expect(saveDb).toHaveBeenCalled();
  });
});

describe('authService.refresh', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns user and new access token for valid token', async () => {
    const tokenRow = { id: 'rt-1', userId: 'user-1', token: 'valid-token', expiresAt: new Date(Date.now() + 60000) };
    const user = makeUser();
    mockDb.select
      .mockReturnValueOnce(makeChain([tokenRow]))
      .mockReturnValueOnce(makeChain([user]));

    const result = await authService.refresh('valid-token');
    expect(result.user.id).toBe('user-1');
    expect(typeof result.accessToken).toBe('string');
  });

  it('throws INVALID_TOKEN when token not found', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await expect(authService.refresh('bad-token'))
      .rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('throws TOKEN_EXPIRED and cleans up when token is expired', async () => {
    const expired = { id: 'rt-1', userId: 'user-1', token: 'old-token', expiresAt: new Date(Date.now() - 1000) };
    mockDb.select.mockReturnValue(makeChain([expired]));
    mockDb.delete.mockReturnValue(makeChain(undefined));

    await expect(authService.refresh('old-token'))
      .rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(mockDb.delete).toHaveBeenCalled();
    expect(saveDb).toHaveBeenCalled();
  });
});

describe('authService.verifyAccessToken', () => {
  it('returns payload for a valid token', () => {
    const token = jwt.sign({ userId: 'u-1', email: 'a@b.com' }, TEST_SECRET, { expiresIn: '15m' });
    const payload = authService.verifyAccessToken(token);
    expect(payload.userId).toBe('u-1');
    expect(payload.email).toBe('a@b.com');
  });

  it('throws INVALID_TOKEN for a bad token', () => {
    expect(() => authService.verifyAccessToken('not.a.token'))
      .toThrow();
  });

  it('throws INVALID_TOKEN for an expired token', () => {
    const token = jwt.sign({ userId: 'u-1' }, TEST_SECRET, { expiresIn: -1 });
    expect(() => authService.verifyAccessToken(token))
      .toThrow();
  });
});

describe('authService.changePassword', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('updates the password hash and returns sanitized user', async () => {
    const user = makeUser();
    const updated = makeUser({ passwordHash: 'hashed:newpassword99' });
    mockDb.select
      .mockReturnValueOnce(makeChain([user]))    // fetch user
      .mockReturnValueOnce(makeChain([updated])); // re-fetch after update
    mockDb.update.mockReturnValue(makeChain(undefined));

    const result = await authService.changePassword('user-1', 'password123', 'newpassword99');

    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(saveDb).toHaveBeenCalledTimes(1);
    expect(result.passwordHash).toBeUndefined();
    expect(result.id).toBe('user-1');
  });

  it('throws INVALID_PASSWORD when current password is wrong', async () => {
    const user = makeUser();
    mockDb.select.mockReturnValue(makeChain([user]));

    await expect(
      authService.changePassword('user-1', 'wrongpassword', 'newpassword99')
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });

    expect(mockDb.update).not.toHaveBeenCalled();
    expect(saveDb).not.toHaveBeenCalled();
  });

  it('throws USER_NOT_FOUND when user does not exist', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await expect(
      authService.changePassword('nobody', 'password123', 'newpassword99')
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});

describe('authService.changeUsername', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('updates displayName and returns sanitized user', async () => {
    const user = makeUser();
    const updated = makeUser({ displayName: 'Bob' });
    mockDb.select
      .mockReturnValueOnce(makeChain([user]))    // fetch user
      .mockReturnValueOnce(makeChain([updated])); // re-fetch after update
    mockDb.update.mockReturnValue(makeChain(undefined));

    const result = await authService.changeUsername('user-1', 'password123', 'Bob');

    expect(mockDb.update).toHaveBeenCalledTimes(2); // users + household_members
    expect(saveDb).toHaveBeenCalledTimes(1);
    expect(result.displayName).toBe('Bob');
    expect(result.passwordHash).toBeUndefined();
  });

  it('trims whitespace from the new username', async () => {
    const user = makeUser();
    const updated = makeUser({ displayName: 'Bob' });
    mockDb.select
      .mockReturnValueOnce(makeChain([user]))
      .mockReturnValueOnce(makeChain([updated]));
    mockDb.update.mockReturnValue(makeChain(undefined));

    await authService.changeUsername('user-1', 'password123', '  Bob  ');

    // Both updates (users and household_members) should use the trimmed value
    const usersSetArg = mockDb.update.mock.results[0].value.set.mock.calls[0][0];
    expect(usersSetArg.displayName).toBe('Bob');
    const membersSetArg = mockDb.update.mock.results[1].value.set.mock.calls[0][0];
    expect(membersSetArg.displayName).toBe('Bob');
  });

  it('throws INVALID_PASSWORD when current password is wrong', async () => {
    const user = makeUser();
    mockDb.select.mockReturnValue(makeChain([user]));

    await expect(
      authService.changeUsername('user-1', 'wrongpassword', 'Bob')
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });

    expect(mockDb.update).not.toHaveBeenCalled();
    expect(saveDb).not.toHaveBeenCalled();
  });

  it('throws USER_NOT_FOUND when user does not exist', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    await expect(
      authService.changeUsername('nobody', 'password123', 'Bob')
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});

describe('authService.getUserById', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns sanitized user when found', async () => {
    const user = makeUser();
    mockDb.select.mockReturnValue(makeChain([user]));

    const result = await authService.getUserById('user-1');
    expect(result.id).toBe('user-1');
    expect(result.passwordHash).toBeUndefined();
  });

  it('returns null when user not found', async () => {
    mockDb.select.mockReturnValue(makeChain([]));

    const result = await authService.getUserById('nobody');
    expect(result).toBeNull();
  });
});
