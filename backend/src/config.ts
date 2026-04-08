import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optional('PORT', '4000'), 10),
  jwtSecret: optional('JWT_SECRET', 'dev-jwt-secret-change-in-production-32chars'),
  jwtRefreshSecret: optional('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production-32chars'),
  jwtExpiresIn: '15m' as const,
  jwtRefreshExpiresIn: '7d' as const,
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:5173'),
  db: {
    host: optional('DB_HOST', 'localhost'),
    port: parseInt(optional('DB_PORT', '5432'), 10),
    database: optional('DB_NAME', 'collab_md'),
    user: optional('DB_USER', 'postgres'),
    password: optional('DB_PASSWORD', 'postgres'),
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  },
} as const;
