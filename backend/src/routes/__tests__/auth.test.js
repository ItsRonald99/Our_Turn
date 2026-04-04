import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

vi.mock('../../services/authService.js', () => ({
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  getUserById: vi.fn(),
  verifyAccessToken: vi.fn(),
  changePassword: vi.fn(),
  changeUsername: vi.fn(),
}));

import * as authService from '../../services/authService.js';
import authRouter from '../auth.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);
  return app;
}

const mockUser = { id: 'u-1', email: 'alice@example.com', displayName: 'Alice' };

describe('POST /auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates account and returns user + accessToken', async () => {
    authService.register.mockResolvedValue({
      user: mockUser,
      accessToken: 'access-tok',
      refreshToken: 'refresh-tok',
    });

    const res = await request(createApp())
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'password123', displayName: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('alice@example.com');
    expect(res.body.data.accessToken).toBe('access-tok');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(createApp())
      .post('/auth/register')
      .send({ email: 'notanemail', password: 'password123', displayName: 'Alice' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 for short password', async () => {
    const res = await request(createApp())
      .post('/auth/register')
      .send({ email: 'a@b.com', password: 'short', displayName: 'Alice' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('returns 400 for missing displayName', async () => {
    const res = await request(createApp())
      .post('/auth/register')
      .send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/displayName/i);
  });

  it('returns 409 when email already exists', async () => {
    const err = new Error('Email already registered');
    err.code = 'EMAIL_EXISTS';
    authService.register.mockRejectedValue(err);

    const res = await request(createApp())
      .post('/auth/register')
      .send({ email: 'a@b.com', password: 'password123', displayName: 'Alice' });

    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user and accessToken on valid credentials', async () => {
    authService.login.mockResolvedValue({
      user: mockUser,
      accessToken: 'access-tok',
      refreshToken: 'refresh-tok',
    });

    const res = await request(createApp())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe('u-1');
    expect(res.body.data.accessToken).toBe('access-tok');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 on invalid credentials', async () => {
    const err = new Error('Invalid credentials');
    err.code = 'INVALID_CREDENTIALS';
    authService.login.mockRejectedValue(err);

    const res = await request(createApp())
      .post('/auth/login')
      .send({ email: 'a@b.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when body is missing', async () => {
    const res = await request(createApp()).post('/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears cookie and returns 204', async () => {
    authService.logout.mockResolvedValue(undefined);

    const res = await request(createApp())
      .post('/auth/logout')
      .set('Cookie', 'refreshToken=some-token');

    expect(res.status).toBe(204);
    expect(authService.logout).toHaveBeenCalledWith('some-token');
  });

  it('returns 204 even without a cookie (idempotent)', async () => {
    const res = await request(createApp()).post('/auth/logout');
    expect(res.status).toBe(204);
    expect(authService.logout).not.toHaveBeenCalled();
  });
});

describe('POST /auth/refresh', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns new accessToken for valid refresh token cookie', async () => {
    authService.refresh.mockResolvedValue({ user: mockUser, accessToken: 'new-access-tok' });

    const res = await request(createApp())
      .post('/auth/refresh')
      .set('Cookie', 'refreshToken=valid-tok');

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('new-access-tok');
  });

  it('returns 401 when no refresh token cookie', async () => {
    const res = await request(createApp()).post('/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('returns 401 and clears cookie for invalid/expired token', async () => {
    const err = new Error('Invalid refresh token');
    err.code = 'INVALID_TOKEN';
    authService.refresh.mockRejectedValue(err);

    const res = await request(createApp())
      .post('/auth/refresh')
      .set('Cookie', 'refreshToken=bad-tok');

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  beforeEach(() => vi.clearAllMocks());

  function authedRequest(app) {
    authService.verifyAccessToken.mockReturnValue({ userId: 'u-1', email: 'alice@example.com' });
    return request(app)
      .post('/auth/change-password')
      .set('Authorization', 'Bearer valid.token');
  }

  it('returns 200 with updated user on success', async () => {
    authService.changePassword.mockResolvedValue(mockUser);

    const res = await authedRequest(createApp())
      .send({ currentPassword: 'oldpass99', newPassword: 'newpass99' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe('u-1');
    expect(authService.changePassword).toHaveBeenCalledWith('u-1', 'oldpass99', 'newpass99');
  });

  it('returns 400 when currentPassword is missing', async () => {
    const res = await authedRequest(createApp())
      .send({ newPassword: 'newpass99' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/current password/i);
  });

  it('returns 400 when newPassword is too short', async () => {
    const res = await authedRequest(createApp())
      .send({ currentPassword: 'oldpass99', newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/i);
  });

  it('returns 401 when current password is wrong', async () => {
    const err = new Error('Current password is incorrect');
    err.code = 'INVALID_PASSWORD';
    authService.changePassword.mockRejectedValue(err);

    const res = await authedRequest(createApp())
      .send({ currentPassword: 'wrongpass', newPassword: 'newpass99' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Current password is incorrect');
  });

  it('returns 401 without Authorization header', async () => {
    authService.verifyAccessToken.mockImplementation(() => { throw new Error(); });
    const res = await request(createApp())
      .post('/auth/change-password')
      .send({ currentPassword: 'oldpass99', newPassword: 'newpass99' });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/change-username', () => {
  beforeEach(() => vi.clearAllMocks());

  function authedRequest(app) {
    authService.verifyAccessToken.mockReturnValue({ userId: 'u-1', email: 'alice@example.com' });
    return request(app)
      .post('/auth/change-username')
      .set('Authorization', 'Bearer valid.token');
  }

  it('returns 200 with updated user on success', async () => {
    authService.changeUsername.mockResolvedValue({ ...mockUser, displayName: 'Bob' });

    const res = await authedRequest(createApp())
      .send({ currentPassword: 'oldpass99', newUsername: 'Bob' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.displayName).toBe('Bob');
    expect(authService.changeUsername).toHaveBeenCalledWith('u-1', 'oldpass99', 'Bob');
  });

  it('returns 400 when currentPassword is missing', async () => {
    const res = await authedRequest(createApp())
      .send({ newUsername: 'Bob' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/current password/i);
  });

  it('returns 400 when newUsername is empty', async () => {
    const res = await authedRequest(createApp())
      .send({ currentPassword: 'oldpass99', newUsername: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/username is required/i);
  });

  it('returns 401 when current password is wrong', async () => {
    const err = new Error('Current password is incorrect');
    err.code = 'INVALID_PASSWORD';
    authService.changeUsername.mockRejectedValue(err);

    const res = await authedRequest(createApp())
      .send({ currentPassword: 'wrongpass', newUsername: 'Bob' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Current password is incorrect');
  });

  it('returns 401 without Authorization header', async () => {
    authService.verifyAccessToken.mockImplementation(() => { throw new Error(); });
    const res = await request(createApp())
      .post('/auth/change-username')
      .send({ currentPassword: 'oldpass99', newUsername: 'Bob' });

    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without a token', async () => {
    authService.verifyAccessToken.mockImplementation(() => { throw new Error(); });
    const res = await request(createApp()).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns user data with a valid token', async () => {
    authService.verifyAccessToken.mockReturnValue({ userId: 'u-1', email: 'alice@example.com' });
    authService.getUserById.mockResolvedValue(mockUser);

    const res = await request(createApp())
      .get('/auth/me')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe('u-1');
  });
});
