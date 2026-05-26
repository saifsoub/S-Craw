import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface SupabaseTokenPayload {
  sub: string;          // user UUID (maps to auth.users.id)
  email: string;
  role: string;
  user_metadata: {
    username?: string;
    [key: string]: unknown;
  };
  aud: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    username: string;
  };
}

/**
 * Verifies a Supabase-issued JWT using the project's JWT secret.
 * The token is sourced from the Authorization: Bearer header.
 * Supabase places the user UUID in `sub`, not `userId`.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, config.supabaseJwtSecret) as SupabaseTokenPayload;

    req.user = {
      userId: payload.sub,
      email: payload.email,
      username: payload.user_metadata?.username ?? payload.email.split('@')[0],
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export function verifyAccessToken(token: string): { userId: string; email: string; username: string } {
  const payload = jwt.verify(token, config.supabaseJwtSecret) as SupabaseTokenPayload;
  return {
    userId: payload.sub,
    email: payload.email,
    username: payload.user_metadata?.username ?? payload.email.split('@')[0],
  };
}
