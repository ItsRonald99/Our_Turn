import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// All API routes are mounted under /api so the same path prefix works
// in both dev (Vite proxy passes /api/* through) and production (no proxy).
app.use('/api/auth', authRouter);
app.use('/api/houses', housesRouter);
app.use('/api/houses/:houseId/chore-types', choreTypesRouter);
app.use('/api/houses/:houseId/members', membersRouter);
app.use('/api/houses/:houseId/assignments', assignmentsRouter);
app.use('/api/houses/:houseId/invitations', houseInvitationsRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/houses/:houseId/dashboard', dashboardRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

// Dev-only endpoint — not available in production
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/dev/send-reminders', requireAuth, async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const result = await sendDailyReminders({ force });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// Serve the React frontend build in production.
// Must come after all API routes so the catch-all doesn't swallow API 404s.
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../public');
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

getDb().then(() => {
  // Bind to 0.0.0.0 so the process is reachable inside Docker / cloud containers.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
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
