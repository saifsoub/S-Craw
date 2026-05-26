import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from './middleware';

const router = Router();

/**
 * Auth is fully handled by Supabase on the client side.
 * This endpoint is kept for server-side session validation
 * (e.g. middleware checks, WebSocket auth debugging).
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  res.json({ user: req.user });
});

export { router as authRouter };
