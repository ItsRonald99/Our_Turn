import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { getDb } from './db/client.js';
import authRouter from './routes/auth.js';
import housesRouter from './routes/houses.js';
import choreTypesRouter from './routes/choreTypes.js';
import membersRouter from './routes/members.js';
import assignmentsRouter from './routes/assignments.js';
import houseInvitationsRouter from './routes/houseInvitations.js';
import invitationsRouter from './routes/invitations.js';
import notificationsRouter from './routes/notifications.js';
import dashboardRouter from './routes/dashboard.js';
import { sendDailyReminders } from './services/reminderService.js';
import { requireAuth } from './middleware/requireAuth.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRouter);
app.use('/houses', housesRouter);
app.use('/houses/:houseId/chore-types', choreTypesRouter);
app.use('/houses/:houseId/members', membersRouter);
app.use('/houses/:houseId/assignments', assignmentsRouter);
app.use('/houses/:houseId/invitations', houseInvitationsRouter);
app.use('/invitations', invitationsRouter);
app.use('/notifications', notificationsRouter);
app.use('/houses/:houseId/dashboard', dashboardRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

// Dev-only endpoint — not available in production
if (process.env.NODE_ENV !== 'production') {
  app.post('/dev/send-reminders', requireAuth, async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const result = await sendDailyReminders({ force });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
  });

  // Daily reminder job — runs at 08:00 UTC every day (skipped in test env)
  if (process.env.NODE_ENV !== 'test') {
    cron.schedule('0 8 * * *', async () => {
      console.log('[cron] Running daily reminders…');
      try {
        const { usersNotified, assignmentsProcessed } = await sendDailyReminders();
        console.log(`[cron] Reminders sent: ${usersNotified} users, ${assignmentsProcessed} assignments`);
      } catch (err) {
        console.error('[cron] Daily reminder job failed:', err.message);
      }
    });
  }
}).catch((err) => {
  console.error('Failed to initialize DB:', err);
  process.exit(1);
});

export { app };
