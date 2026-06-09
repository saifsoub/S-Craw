import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { checkDatabaseConnection } from './db';
import { authRouter } from './auth/router';
import { documentsRouter } from './documents/router';
import { setupWebSocketServer } from './ws/handler';

async function main(): Promise<void> {
  await checkDatabaseConnection();

  const app = express();

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/documents', documentsRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[express] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const server = http.createServer(app);
  setupWebSocketServer(server);

  server.listen(config.port, () => {
    console.log(`[server] HTTP  → http://localhost:${config.port}`);
    console.log(`[server] WS   → ws://localhost:${config.port}/ws`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n[server] ${signal} — shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
