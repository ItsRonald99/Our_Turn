import nodemailer from 'nodemailer';

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

/**
 * Send a single digest email listing all due/overdue assignments for one user.
 * Falls back to console output when SMTP is not configured (dev/test environments).
 *
 * @param {{ toEmail: string, userName: string, assignments: Array<{ choreName: string, houseName: string, dueDate: Date }> }} opts
 */
export async function sendDigestEmail({ toEmail, userName, assignments }) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const lines = assignments.map((a) => {
    const due = new Date(a.dueDate);
    const isOverdue = due < todayStart;
    const dueDateStr = due.toISOString().slice(0, 10);
    return `  - ${a.choreName} in ${a.houseName} (due ${dueDateStr})${isOverdue ? ' — OVERDUE' : ''}`;
  });

  const text = [
    `Hi ${userName},`,
    '',
    'Here are your chores that need attention:',
    '',
    ...lines,
    '',
    'Log in to Our Turn to mark them complete.',
  ].join('\n');

  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[emailService] SMTP not configured — would have sent to ${toEmail}:\n${text}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_USER || 'reminders@ourturn.app',
    to: toEmail,
    subject: 'Daily Chore Reminder',
    text,
  });
}
