import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db';
import { config } from '../config';

export interface UserPublic {
  id: string;
  email: string;
  username: string;
  created_at: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ─── Registration ────────────────────────────────────────────────────────────

export async function registerUser(
  email: string,
  username: string,
  password: string,
): Promise<{ user: UserPublic; tokens: TokenPair }> {
  const conflict = await pool.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email.toLowerCase(), username.toLowerCase()],
  );
  if (conflict.rows.length > 0) {
    throw Object.assign(new Error('Email or username already in use'), { code: 'CONFLICT' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query<UserPublic>(
    `INSERT INTO users (email, username, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, username, created_at`,
    [email.toLowerCase(), username.toLowerCase(), passwordHash],
  );

  const user = result.rows[0];
  const tokens = await generateTokenPair(user.id);
  return { user, tokens };
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function loginUser(
  emailOrUsername: string,
  password: string,
): Promise<{ user: UserPublic; tokens: TokenPair }> {
  const result = await pool.query<UserPublic & { password_hash: string }>(
    `SELECT id, email, username, password_hash, created_at
     FROM users
     WHERE email = $1 OR username = $1`,
    [emailOrUsername.toLowerCase()],
  );

  const user = result.rows[0];
  // Constant-time comparison even on missing user (run bcrypt on dummy hash)
  const hash = user?.password_hash ?? '$2a$12$invalidhashfortimingresistaance';
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'UNAUTHORIZED' });
  }

  const tokens = await generateTokenPair(user.id);
  const { password_hash: _omit, ...safeUser } = user;
  return { user: safeUser as UserPublic, tokens };
}

// ─── Token Refresh ───────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  let payload: { userId: string };
  try {
    payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as { userId: string };
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { code: 'UNAUTHORIZED' });
  }

  const tokenHash = hashToken(refreshToken);
  const found = await pool.query(
    `SELECT id FROM refresh_tokens
     WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()`,
    [payload.userId, tokenHash],
  );

  if (found.rows.length === 0) {
    throw Object.assign(new Error('Refresh token revoked or expired'), { code: 'UNAUTHORIZED' });
  }

  // Rotate: invalidate current token before issuing a new one
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  return generateTokenPair(payload.userId);
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logoutUser(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
}

// ─── Token Verification ──────────────────────────────────────────────────────

export interface AccessTokenPayload {
  userId: string;
  email: string;
  username: string;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwtSecret) as AccessTokenPayload;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generateTokenPair(userId: string): Promise<TokenPair> {
  const userRow = await pool.query<{ email: string; username: string }>(
    'SELECT email, username FROM users WHERE id = $1',
    [userId],
  );
  if (userRow.rows.length === 0) throw new Error('User not found');

  const { email, username } = userRow.rows[0];

  const accessToken = jwt.sign(
    { userId, email, username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );

  const refreshToken = jwt.sign(
    { userId },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiresIn },
  );

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  return { accessToken, refreshToken };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
