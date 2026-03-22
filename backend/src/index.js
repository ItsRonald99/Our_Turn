import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getDb } from './db/client.js';
import authRouter from './routes/auth.js';
import housesRouter from './routes/houses.js';
import choreTypesRouter from './routes/choreTypes.js';
import membersRouter from './routes/members.js';
import assignmentsRouter from './routes/assignments.js';

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

app.get('/health', (_req, res) => res.json({ ok: true }));

getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize DB:', err);
  process.exit(1);
});

export { app };
