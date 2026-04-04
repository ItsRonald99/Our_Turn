import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDbSync, saveDb } from '../db/client.js';
import { users, refreshTokens, householdMembers } from '../db/schema.js';

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-secret-change-in-production';
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);

function issueAccessToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

async function createRefreshToken(userId) {
  const db = getDbSync();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(refreshTokens).values({
    id: randomUUID(),
    userId,
    token,
    expiresAt,
    createdAt: new Date(),
  });
  saveDb();
  return token;
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function register(email, password, displayName) {
  const db = getDbSync();
  const normalizedEmail = email.toLowerCase().trim();

  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    const err = new Error('Email already registered');
    err.code = 'EMAIL_EXISTS';
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: normalizedEmail,
    passwordHash,
    displayName: displayName.trim(),
    createdAt: new Date(),
  });
  saveDb();

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const accessToken = issueAccessToken(user);
  const refreshToken = await createRefreshToken(user.id);
  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function login(email, password) {
  const db = getDbSync();
  const normalizedEmail = email.toLowerCase().trim();

  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (!user) {
    const err = new Error('Invalid credentials');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid credentials');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const accessToken = issueAccessToken(user);
  const refreshToken = await createRefreshToken(user.id);
  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function logout(token) {
  const db = getDbSync();
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
  saveDb();
}

export async function refresh(token) {
  const db = getDbSync();
  const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token)).limit(1);

  if (!row) {
    const err = new Error('Invalid refresh token');
    err.code = 'INVALID_TOKEN';
    throw err;
  }
  if (row.expiresAt < new Date()) {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
    saveDb();
    const err = new Error('Refresh token expired');
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }

  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user) {
    const err = new Error('User not found');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  return { user: sanitizeUser(user), accessToken: issueAccessToken(user) };
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    const err = new Error('Invalid or expired token');
    err.code = 'INVALID_TOKEN';
    throw err;
  }
}

export async function getUserById(userId) {
  const db = getDbSync();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ? sanitizeUser(user) : null;
}

export async function changePassword(userId, currentPassword, newPassword) {
  const db = getDbSync();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    const err = new Error('User not found');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  saveDb();

  const [updated] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return sanitizeUser(updated);
}

export async function changeUsername(userId, currentPassword, newUsername) {
  const db = getDbSync();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    const err = new Error('User not found');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }

  const trimmed = newUsername.trim();
  await db.update(users).set({ displayName: trimmed }).where(eq(users.id, userId));
  await db.update(householdMembers).set({ displayName: trimmed }).where(eq(householdMembers.userId, userId));
  saveDb();

  const [updated] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return sanitizeUser(updated);
}
