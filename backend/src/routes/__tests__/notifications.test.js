import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../middleware/requireAuth.js', () => ({
  requireAuth: (_req, _res, next) => next(),
}));

vi.mock('../../services/notificationService.js', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

import { listNotifications, markNotificationRead } from '../../services/notificationService.js';
import notificationsRouter from '../notifications.js';

function createApp(userId = 'user-1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId, email: 'user@test.com' };
    next();
  });
  app.use('/notifications', notificationsRouter);
  return app;
}

const makeNotification = (overrides = {}) => ({
  id: 'n-1',
  userId: 'user-1',
  type: 'assignment_reminder',
  title: 'Chore Due',
  message: 'Dishes is due in Our House',
  isRead: false,
  createdAt: new Date(),
  ...overrides,
});

describe('GET /notifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with the user\'s notifications', async () => {
    const notifications = [makeNotification(), makeNotification({ id: 'n-2', isRead: true })];
    listNotifications.mockResolvedValue(notifications);

    const res = await request(createApp('user-1')).get('/notifications');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(listNotifications).toHaveBeenCalledWith('user-1');
  });

  it('returns 200 with an empty array when the user has no notifications', async () => {
    listNotifications.mockResolvedValue([]);

    const res = await request(createApp()).get('/notifications');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when the service throws', async () => {
    listNotifications.mockRejectedValue(new Error('DB failure'));

    const res = await request(createApp()).get('/notifications');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB failure');
  });

  it('passes the authenticated user\'s id to the service', async () => {
    listNotifications.mockResolvedValue([]);

    await request(createApp('custom-user-id')).get('/notifications');
    expect(listNotifications).toHaveBeenCalledWith('custom-user-id');
  });
});

describe('POST /notifications/:id/read', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with the updated notification on success', async () => {
    const updated = makeNotification({ isRead: true });
    markNotificationRead.mockResolvedValue(updated);

    const res = await request(createApp('user-1')).post('/notifications/n-1/read');
    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
    expect(markNotificationRead).toHaveBeenCalledWith('user-1', 'n-1');
  });

  it('returns 404 when the service returns null (notification not found or wrong user)', async () => {
    markNotificationRead.mockResolvedValue(null);

    const res = await request(createApp('user-1')).post('/notifications/nope/read');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Notification not found');
  });

  it('returns 500 when the service throws', async () => {
    markNotificationRead.mockRejectedValue(new Error('DB failure'));

    const res = await request(createApp()).post('/notifications/n-1/read');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('DB failure');
  });

  it('passes the authenticated user\'s id to the service', async () => {
    markNotificationRead.mockResolvedValue(makeNotification({ isRead: true }));

    await request(createApp('custom-user-id')).post('/notifications/n-1/read');
    expect(markNotificationRead).toHaveBeenCalledWith('custom-user-id', 'n-1');
  });
});
