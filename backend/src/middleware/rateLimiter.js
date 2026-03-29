import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

/**
 * Strict limiter for the house-join endpoint.
 * An invite code has only 1 million possibilities, so we tightly cap
 * the number of attempts per IP per window to prevent brute-force enumeration.
 */
export const joinHouseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Too many join attempts. Please try again in 15 minutes.' },
});

/**
 * Limiter for invitation-send endpoints.
 * Prevents flooding another user with invitations.
 */
export const invitationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Too many invitation requests. Please try again in 15 minutes.' },
});
