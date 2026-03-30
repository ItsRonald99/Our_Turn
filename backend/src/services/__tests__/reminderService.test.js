import { vi, describe, it, expect, beforeEach } from 'vitest';
import { makeChain, createMockDb } from '../../test/helpers.js';

vi.mock('../../db/client.js', () => ({
  getDbSync: vi.fn(),
  saveDb: vi.fn(),
}));

vi.mock('../emailService.js', () => ({
  sendDigestEmail: vi.fn(),
}));

vi.mock('../notificationService.js', () => ({
  createNotification: vi.fn(),
}));

import { getDbSync, saveDb } from '../../db/client.js';
import { sendDigestEmail } from '../emailService.js';
import { createNotification } from '../notificationService.js';
import { sendDailyReminders } from '../reminderService.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const makeAssignment = (overrides = {}) => ({
  id: 'a-1',
  houseId: 'h-1',
  choreTypeId: 'ct-1',
  memberId: 'm-1',
  dueDate: new Date(Date.now() - 86_400_000), // yesterday
  completedAt: null,
  lastReminderSentAt: null,
  ...overrides,
});

const makeMember = (overrides = {}) => ({
  id: 'm-1', houseId: 'h-1', displayName: 'Alice', userId: 'user-1', ...overrides,
});

const makeUser = (overrides = {}) => ({
  id: 'user-1', email: 'alice@example.com', displayName: 'Alice', ...overrides,
});

const makeChoreType = (overrides = {}) => ({
  id: 'ct-1', houseId: 'h-1', name: 'Dishes', ...overrides,
});

const makeHouse = (overrides = {}) => ({
  id: 'h-1', name: 'Our House', ...overrides,
});

// Queue select mocks for a single fully-enriched assignment:
//   call 0 — due assignments list
//   call 1 — member
//   call 2 — user
//   call 3 — choreType
//   call 4 — house
function setupSingleAssignment(mockDb, { assignment, member, user, choreType, house } = {}) {
  mockDb.select
    .mockReturnValueOnce(makeChain([assignment ?? makeAssignment()]))
    .mockReturnValueOnce(makeChain([member ?? makeMember()]))
    .mockReturnValueOnce(makeChain([user ?? makeUser()]))
    .mockReturnValueOnce(makeChain([choreType ?? makeChoreType()]))
    .mockReturnValueOnce(makeChain([house ?? makeHouse()]));
}

describe('reminderService.sendDailyReminders', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    vi.clearAllMocks();
    getDbSync.mockReturnValue(mockDb);
    sendDigestEmail.mockResolvedValue(undefined);
    createNotification.mockResolvedValue('n-new');
    mockDb.update.mockReturnValue(makeChain(undefined));
  });

  // ---------------------------------------------------------------------------
  // No due assignments
  // ---------------------------------------------------------------------------
  it('returns { usersNotified: 0, assignmentsProcessed: 0 } when there are no due assignments', async () => {
    mockDb.select.mockReturnValueOnce(makeChain([]));

    const result = await sendDailyReminders();
    expect(result).toEqual({ usersNotified: 0, assignmentsProcessed: 0 });
    expect(sendDigestEmail).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
    expect(saveDb).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Happy path — single assignment
  // ---------------------------------------------------------------------------
  it('sends a digest email and creates a notification for a single due assignment', async () => {
    setupSingleAssignment(mockDb);

    const result = await sendDailyReminders();

    expect(result).toEqual({ usersNotified: 1, assignmentsProcessed: 1 });
    expect(sendDigestEmail).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(saveDb).toHaveBeenCalledTimes(1);
  });

  it('calls sendDigestEmail with the correct user email and assignment info', async () => {
    setupSingleAssignment(mockDb);

    await sendDailyReminders();

    expect(sendDigestEmail).toHaveBeenCalledWith(expect.objectContaining({
      toEmail: 'alice@example.com',
      userName: 'Alice',
      assignments: [expect.objectContaining({ choreName: 'Dishes', houseName: 'Our House' })],
    }));
  });

  it('creates a notification with type assignment_reminder', async () => {
    setupSingleAssignment(mockDb);

    await sendDailyReminders();

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      type: 'assignment_reminder',
      title: 'Chore Due',
    }));
  });

  it('stamps lastReminderSentAt on the assignment after success', async () => {
    setupSingleAssignment(mockDb);

    await sendDailyReminders();

    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Overdue vs due labeling in notifications
  // ---------------------------------------------------------------------------
  it('labels the notification message as "overdue" for past-due assignments', async () => {
    const pastDue = makeAssignment({ dueDate: new Date(Date.now() - 2 * 86_400_000) });
    setupSingleAssignment(mockDb, { assignment: pastDue });

    await sendDailyReminders();

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('overdue'),
    }));
  });

  it('labels the notification message as "due" (not overdue) for today\'s assignments', async () => {
    // dueDate = midnight UTC today → not overdue from today's perspective
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    setupSingleAssignment(mockDb, { assignment: makeAssignment({ dueDate: todayStart }) });

    await sendDailyReminders();

    const call = createNotification.mock.calls[0][0];
    // The message should say "due" and NOT contain "overdue"
    expect(call.message).toContain('due');
    expect(call.message).not.toContain('overdue');
  });

  // ---------------------------------------------------------------------------
  // Guest / unlinked members (no userId)
  // ---------------------------------------------------------------------------
  it('skips assignments where the member has no userId', async () => {
    const guestMember = makeMember({ userId: null });
    mockDb.select
      .mockReturnValueOnce(makeChain([makeAssignment()]))
      .mockReturnValueOnce(makeChain([guestMember]));

    const result = await sendDailyReminders();

    expect(result).toEqual({ usersNotified: 0, assignmentsProcessed: 0 });
    expect(sendDigestEmail).not.toHaveBeenCalled();
  });

  it('skips assignments where the member row is missing entirely', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([makeAssignment()]))
      .mockReturnValueOnce(makeChain([]));  // member not found

    const result = await sendDailyReminders();

    expect(result).toEqual({ usersNotified: 0, assignmentsProcessed: 0 });
    expect(sendDigestEmail).not.toHaveBeenCalled();
  });

  it('skips assignments where the user record is missing', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([makeAssignment()]))
      .mockReturnValueOnce(makeChain([makeMember()]))
      .mockReturnValueOnce(makeChain([]));  // user not found

    const result = await sendDailyReminders();

    expect(result).toEqual({ usersNotified: 0, assignmentsProcessed: 0 });
    expect(sendDigestEmail).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Email failure — should not stamp lastReminderSentAt
  // ---------------------------------------------------------------------------
  it('does not stamp lastReminderSentAt or call saveDb when email sending fails', async () => {
    setupSingleAssignment(mockDb);
    sendDigestEmail.mockRejectedValue(new Error('SMTP connection refused'));

    const result = await sendDailyReminders();

    // User was not notified successfully
    expect(result.usersNotified).toBe(0);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(saveDb).not.toHaveBeenCalled();
  });

  it('continues processing other users when one user\'s email fails', async () => {
    const a1 = makeAssignment({ id: 'a-1', memberId: 'm-1' });
    const a2 = makeAssignment({ id: 'a-2', memberId: 'm-2' });
    const member2 = makeMember({ id: 'm-2', userId: 'user-2' });
    const user2 = makeUser({ id: 'user-2', email: 'bob@example.com', displayName: 'Bob' });

    // Promise.all interleaves: all members first, then all users, then all
    // choreTypes, then all houses (each "column" before advancing to next).
    mockDb.select
      .mockReturnValueOnce(makeChain([a1, a2]))          // due assignments
      .mockReturnValueOnce(makeChain([makeMember()]))    // a1 member
      .mockReturnValueOnce(makeChain([member2]))         // a2 member
      .mockReturnValueOnce(makeChain([makeUser()]))      // a1 user
      .mockReturnValueOnce(makeChain([user2]))           // a2 user
      .mockReturnValueOnce(makeChain([makeChoreType()])) // a1 choreType
      .mockReturnValueOnce(makeChain([makeChoreType()])) // a2 choreType
      .mockReturnValueOnce(makeChain([makeHouse()]))     // a1 house
      .mockReturnValueOnce(makeChain([makeHouse()]));    // a2 house

    // First user's email fails, second succeeds
    sendDigestEmail
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockResolvedValueOnce(undefined);

    const result = await sendDailyReminders();

    // Only second user was successfully notified
    expect(result.usersNotified).toBe(1);
    expect(result.assignmentsProcessed).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Multiple assignments grouped into one email per user
  // ---------------------------------------------------------------------------
  it('sends exactly one email for a user with two due assignments', async () => {
    const a1 = makeAssignment({ id: 'a-1', choreTypeId: 'ct-1' });
    const a2 = makeAssignment({ id: 'a-2', choreTypeId: 'ct-2' });
    const ct2 = makeChoreType({ id: 'ct-2', name: 'Trash' });

    // Promise.all interleaves: all members, then all users, then all choreTypes,
    // then all houses before advancing to the next "row".
    mockDb.select
      .mockReturnValueOnce(makeChain([a1, a2]))          // due assignments
      .mockReturnValueOnce(makeChain([makeMember()]))    // a1 member (same user)
      .mockReturnValueOnce(makeChain([makeMember()]))    // a2 member (same user)
      .mockReturnValueOnce(makeChain([makeUser()]))      // a1 user
      .mockReturnValueOnce(makeChain([makeUser()]))      // a2 user
      .mockReturnValueOnce(makeChain([makeChoreType()])) // a1 choreType
      .mockReturnValueOnce(makeChain([ct2]))             // a2 choreType
      .mockReturnValueOnce(makeChain([makeHouse()]))     // a1 house
      .mockReturnValueOnce(makeChain([makeHouse()]));    // a2 house

    const result = await sendDailyReminders();

    expect(sendDigestEmail).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ usersNotified: 1, assignmentsProcessed: 2 });

    const emailCall = sendDigestEmail.mock.calls[0][0];
    expect(emailCall.assignments).toHaveLength(2);
    expect(emailCall.assignments.map((a) => a.choreName)).toContain('Dishes');
    expect(emailCall.assignments.map((a) => a.choreName)).toContain('Trash');
  });

  // ---------------------------------------------------------------------------
  // Fallback names when choreType / house records are missing
  // ---------------------------------------------------------------------------
  it('falls back to "Unknown chore" and "Unknown house" when records are missing', async () => {
    mockDb.select
      .mockReturnValueOnce(makeChain([makeAssignment()]))
      .mockReturnValueOnce(makeChain([makeMember()]))
      .mockReturnValueOnce(makeChain([makeUser()]))
      .mockReturnValueOnce(makeChain([]))  // choreType not found
      .mockReturnValueOnce(makeChain([])); // house not found

    await sendDailyReminders();

    expect(sendDigestEmail).toHaveBeenCalledWith(expect.objectContaining({
      assignments: [expect.objectContaining({
        choreName: 'Unknown chore',
        houseName: 'Unknown house',
      })],
    }));
  });
});
