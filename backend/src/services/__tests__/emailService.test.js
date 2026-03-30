import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// vi.mock is hoisted to the top of the file, so any variables it references
// must also be hoisted via vi.hoisted() to avoid TDZ errors.
const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn();
  const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }));
  return { mockSendMail, mockCreateTransport };
});

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
}));

import { sendDigestEmail } from '../emailService.js';

const BASE_OPTS = {
  toEmail: 'alice@example.com',
  userName: 'Alice',
  assignments: [
    { choreName: 'Dishes', houseName: 'Our House', dueDate: new Date() },
  ],
};

describe('emailService.sendDigestEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SMTP_HOST;
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
  });

  // ---------------------------------------------------------------------------
  // No SMTP configured
  // ---------------------------------------------------------------------------
  describe('when SMTP_HOST is not set', () => {
    it('resolves without error', async () => {
      await expect(sendDigestEmail(BASE_OPTS)).resolves.toBeUndefined();
    });

    it('does not call nodemailer.createTransport', async () => {
      await sendDigestEmail(BASE_OPTS);
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('logs to console instead of sending', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await sendDigestEmail(BASE_OPTS);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('alice@example.com'));
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // SMTP configured
  // ---------------------------------------------------------------------------
  describe('when SMTP_HOST is set', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      mockSendMail.mockResolvedValue({ messageId: 'msg-1' });
    });

    it('calls sendMail with the correct recipient and subject', async () => {
      await sendDigestEmail(BASE_OPTS);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('alice@example.com');
      expect(call.subject).toBe('Daily Chore Reminder');
    });

    it('includes the chore name and house name in the email body', async () => {
      await sendDigestEmail(BASE_OPTS);
      const { text } = mockSendMail.mock.calls[0][0];
      expect(text).toContain('Dishes');
      expect(text).toContain('Our House');
    });

    it('includes the user name in the greeting', async () => {
      await sendDigestEmail(BASE_OPTS);
      const { text } = mockSendMail.mock.calls[0][0];
      expect(text).toContain('Alice');
    });
  });

  // ---------------------------------------------------------------------------
  // Overdue vs due-today formatting
  // ---------------------------------------------------------------------------
  describe('overdue vs due-today formatting', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      mockSendMail.mockResolvedValue({});
    });

    it('marks past-due assignments as OVERDUE', async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      await sendDigestEmail({
        toEmail: 'alice@example.com',
        userName: 'Alice',
        assignments: [{ choreName: 'Trash', houseName: 'Our House', dueDate: yesterday }],
      });

      const { text } = mockSendMail.mock.calls[0][0];
      expect(text).toContain('OVERDUE');
    });

    it('does not mark future assignments as OVERDUE', async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      await sendDigestEmail({
        toEmail: 'alice@example.com',
        userName: 'Alice',
        assignments: [{ choreName: 'Vacuum', houseName: 'Our House', dueDate: tomorrow }],
      });

      const { text } = mockSendMail.mock.calls[0][0];
      expect(text).not.toContain('OVERDUE');
    });

    it('includes all assignments in a single email', async () => {
      await sendDigestEmail({
        toEmail: 'alice@example.com',
        userName: 'Alice',
        assignments: [
          { choreName: 'Dishes', houseName: 'Our House', dueDate: new Date() },
          { choreName: 'Trash', houseName: 'Our House', dueDate: new Date() },
        ],
      });

      const { text } = mockSendMail.mock.calls[0][0];
      expect(text).toContain('Dishes');
      expect(text).toContain('Trash');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });
  });
});
