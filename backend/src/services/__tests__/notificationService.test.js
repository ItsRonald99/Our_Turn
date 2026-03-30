import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain, createMockDb } from '../../test/helpers.js';

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn(),
  saveDb: vi.fn(),
}));

import { getDbSync, saveDb } from '../../db/client.js';
import * as service from '../notificationService.js';

describe('notificationService', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
  });

  // ---------------------------------------------------------------------------
  // createNotification
  // ---------------------------------------------------------------------------
  describe('createNotification', () => {
    it('inserts a notification row and returns its id', async () => {
      mockDb.insert.mockReturnValue(makeChain(undefined));

      const id = await service.createNotification({
        userId: 'user-1',
        type: 'assignment_reminder',
        title: 'Chore Due',
        message: 'Dishes is due in Our House',
      });

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('inserts with correct fields', async () => {
      mockDb.insert.mockReturnValue(makeChain(undefined));

      await service.createNotification({
        userId: 'user-1',
        type: 'assignment_reminder',
        title: 'Chore Due',
        message: 'Dishes is due in Our House',
      });

      const inserted = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(inserted.userId).toBe('user-1');
      expect(inserted.type).toBe('assignment_reminder');
      expect(inserted.title).toBe('Chore Due');
      expect(inserted.message).toBe('Dishes is due in Our House');
      expect(inserted.isRead).toBe(false);
      expect(inserted.createdAt).toBeInstanceOf(Date);
    });

    it('does NOT call saveDb — caller is responsible for batching saves', async () => {
      mockDb.insert.mockReturnValue(makeChain(undefined));

      await service.createNotification({
        userId: 'user-1', type: 'assignment_reminder',
        title: 'Chore Due', message: 'msg',
      });

      expect(saveDb).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // listNotifications
  // ---------------------------------------------------------------------------
  describe('listNotifications', () => {
    it('returns notifications for the given user ordered by createdAt desc', async () => {
      const rows = [
        { id: 'n-2', userId: 'user-1', type: 'assignment_reminder', title: 'T2', message: 'M2', isRead: false, createdAt: new Date() },
        { id: 'n-1', userId: 'user-1', type: 'assignment_reminder', title: 'T1', message: 'M1', isRead: true, createdAt: new Date() },
      ];
      mockDb.select.mockReturnValue(makeChain(rows));

      const result = await service.listNotifications('user-1');
      expect(result).toEqual(rows);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when the user has no notifications', async () => {
      mockDb.select.mockReturnValue(makeChain([]));

      const result = await service.listNotifications('user-1');
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // markNotificationRead
  // ---------------------------------------------------------------------------
  describe('markNotificationRead', () => {
    it('returns null when the notification does not exist', async () => {
      mockDb.select.mockReturnValue(makeChain([]));

      const result = await service.markNotificationRead('user-1', 'nope');
      expect(result).toBeNull();
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(saveDb).not.toHaveBeenCalled();
    });

    it('returns null when the notification belongs to a different user', async () => {
      // The query already includes userId in the WHERE, so an empty result
      // means ownership check failed at the DB level.
      mockDb.select.mockReturnValue(makeChain([]));

      const result = await service.markNotificationRead('other-user', 'n-1');
      expect(result).toBeNull();
    });

    it('updates isRead to true, calls saveDb, and returns the updated row', async () => {
      const existing = { id: 'n-1', userId: 'user-1', isRead: false, type: 'assignment_reminder', title: 'T', message: 'M', createdAt: new Date() };
      const updated = { ...existing, isRead: true };

      mockDb.select
        .mockReturnValueOnce(makeChain([existing]))  // ownership check
        .mockReturnValueOnce(makeChain([updated]));  // re-fetch after update
      mockDb.update.mockReturnValue(makeChain(undefined));

      const result = await service.markNotificationRead('user-1', 'n-1');
      expect(result.isRead).toBe(true);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(saveDb).toHaveBeenCalledTimes(1);
    });
  });
});
