import { vi, describe, it, expect, beforeEach } from 'vitest';

process.env.JWT_SECRET = 'test-secret-for-middleware';

vi.mock('../../services/authService.js', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn(),
}));

import { verifyAccessToken } from '../../services/authService.js';
import { getDbSync } from '../../db/client.js';
import { requireAuth } from '../requireAuth.js';
import { requireHouseMember } from '../requireHouseMember.js';
import { requireHouseOwner } from '../requireHouseOwner.js';
import { makeChain, createMockDb } from '../../test/helpers.js';

function mockRes() {
  const res = { statusCode: 200 };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn(() => res);
  return res;
}

function mockReq(headers = {}, params = {}) {
  return { headers, params, user: undefined };
}

describe('requireAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when Authorization header is missing', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer', () => {
    const req = mockReq({ authorization: 'Basic abc' });
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token verification fails', () => {
    verifyAccessToken.mockImplementation(() => { throw new Error('invalid'); });
    const req = mockReq({ authorization: 'Bearer bad.token' });
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.user and calls next on a valid token', () => {
    verifyAccessToken.mockReturnValue({ userId: 'u-1', email: 'a@b.com' });
    const req = mockReq({ authorization: 'Bearer valid.token' });
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ userId: 'u-1', email: 'a@b.com' });
  });
});

describe('requireHouseMember', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  it('returns 403 when no user on request', async () => {
    const req = { params: { houseId: 'h-1' }, user: undefined };
    const res = mockRes();
    const next = vi.fn();

    await requireHouseMember(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not a member of the house', async () => {
    mockDb.select.mockReturnValue(makeChain([]));
    const req = { params: { houseId: 'h-1' }, user: { userId: 'u-1' } };
    const res = mockRes();
    const next = vi.fn();

    await requireHouseMember(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.member and calls next when user is a member', async () => {
    const member = { id: 'm-1', houseId: 'h-1', userId: 'u-1', displayName: 'Alice', role: 'member' };
    mockDb.select.mockReturnValue(makeChain([member]));
    const req = { params: { houseId: 'h-1' }, user: { userId: 'u-1' } };
    const res = mockRes();
    const next = vi.fn();

    await requireHouseMember(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.member).toEqual(member);
  });
});

describe('requireHouseOwner', () => {
  it('calls next when req.member.role is "owner"', () => {
    const req = { member: { role: 'owner' } };
    const res = mockRes();
    const next = vi.fn();

    requireHouseOwner(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when req.member.role is "member"', () => {
    const req = { member: { role: 'member' } };
    const res = mockRes();
    const next = vi.fn();

    requireHouseOwner(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when req.member is undefined', () => {
    const req = { member: undefined };
    const res = mockRes();
    const next = vi.fn();

    requireHouseOwner(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when role is an unrecognised value', () => {
    const req = { member: { role: 'moderator' } };
    const res = mockRes();
    const next = vi.fn();

    requireHouseOwner(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
