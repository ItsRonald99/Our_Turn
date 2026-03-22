import { Router } from 'express';
import * as authService from '../services/authService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

const COOKIE_NAME = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10) * 24 * 60 * 60 * 1000,
  path: '/',
};

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** POST /auth/register */
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body ?? {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      return res.status(400).json({ error: 'displayName is required' });
    }

    const { user, accessToken, refreshToken } = await authService.register(email, password, displayName);
    res.cookie(COOKIE_NAME, refreshToken, COOKIE_OPTIONS);
    res.status(201).json({ data: { user, accessToken } });
  } catch (err) {
    if (err.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/** POST /auth/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!isValidEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { user, accessToken, refreshToken } = await authService.login(email, password);
    res.cookie(COOKIE_NAME, refreshToken, COOKIE_OPTIONS);
    res.json({ data: { user, accessToken } });
  } catch (err) {
    if (err.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.status(500).json({ error: err.message });
  }
});

/** POST /auth/logout */
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      await authService.logout(token);
    }
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /auth/refresh */
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'No refresh token' });
    }
    const { user, accessToken } = await authService.refresh(token);
    res.json({ data: { user, accessToken } });
  } catch (err) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    if (err.code === 'INVALID_TOKEN' || err.code === 'TOKEN_EXPIRED') {
      return res.status(401).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/** GET /auth/me */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ data: { user } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
