import { Router, Request, Response } from 'express';
import { registerUser, loginUser, refreshAccessToken, logoutUser } from './service';
import { requireAuth, AuthenticatedRequest } from './middleware';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, username, password } = req.body ?? {};

  if (!email || !username || !password) {
    res.status(400).json({ error: 'email, username, and password are required' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  try {
    const result = await registerUser(String(email), String(username), String(password));
    res.status(201).json(result);
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    if (e.code === 'CONFLICT') {
      res.status(409).json({ error: e.message });
    } else {
      console.error('[auth/register]', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { emailOrUsername, password } = req.body ?? {};

  if (!emailOrUsername || !password) {
    res.status(400).json({ error: 'emailOrUsername and password are required' });
    return;
  }

  try {
    const result = await loginUser(String(emailOrUsername), String(password));
    res.json(result);
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    if (e.code === 'UNAUTHORIZED') {
      res.status(401).json({ error: e.message });
    } else {
      console.error('[auth/login]', err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }

  try {
    const tokens = await refreshAccessToken(String(refreshToken));
    res.json(tokens);
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    if (e.code === 'UNAUTHORIZED') {
      res.status(401).json({ error: e.message });
    } else {
      console.error('[auth/refresh]', err);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }
});

// POST /api/auth/logout  (requires valid access token)
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { refreshToken } = req.body ?? {};
  try {
    if (refreshToken) await logoutUser(String(refreshToken));
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[auth/logout]', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  res.json({ user: req.user });
});

export { router as authRouter };
