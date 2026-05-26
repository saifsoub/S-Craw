import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    username: string;
    accessToken: string;
  };
}

/**
 * Validates a Supabase access token by calling supabase.auth.getUser().
 * This is a network round-trip to Supabase Auth, but eliminates the need
 * to store or manage the JWT secret locally.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.slice(7);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired access token' });
    return;
  }

  req.user = {
    userId: data.user.id,
    email: data.user.email ?? '',
    username: (data.user.user_metadata?.username as string) ?? data.user.email?.split('@')[0] ?? '',
    accessToken: token,
  };

  next();
}

/**
 * Token verification for the WebSocket handler (not Express middleware).
 * Returns the user payload or throws.
 */
export async function verifyToken(
  token: string,
): Promise<{ userId: string; email: string; username: string }> {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired token');

  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    username: (data.user.user_metadata?.username as string) ?? data.user.email?.split('@')[0] ?? '',
  };
}
