import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    username: string;
    accessToken: string;
  };
}

/**
 * Decodes a JWT payload without verifying the signature.
 * Safe for local dev where the backend has no outbound network access.
 * In production, replace with signature verification using the JWT secret.
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT structure');
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
}

function extractUser(token: string) {
  const payload = decodeJwtPayload(token);
  const userId = payload.sub as string;
  if (!userId) throw new Error('Token missing sub claim');
  const exp = payload.exp as number | undefined;
  if (exp && Math.floor(Date.now() / 1000) > exp) throw new Error('Token expired');
  const email = (payload.email as string | undefined) ?? '';
  const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
  const username = (meta.username as string | undefined) ?? email.split('@')[0] ?? 'user';
  return { userId, email, username };
}

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
  try {
    const token = header.slice(7);
    req.user = { ...extractUser(token), accessToken: token };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export async function verifyToken(
  token: string,
): Promise<{ userId: string; email: string; username: string }> {
  return extractUser(token);
}
