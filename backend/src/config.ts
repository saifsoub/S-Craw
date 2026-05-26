import dotenv from 'dotenv';
dotenv.config();

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optional('PORT', '4000'), 10),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:5173'),

  /**
   * Supabase JWT secret — used to verify tokens issued by Supabase Auth.
   * Found in: Supabase Dashboard → Settings → API → JWT Secret
   */
  supabaseJwtSecret: optional('SUPABASE_JWT_SECRET', ''),

  /**
   * Direct PostgreSQL connection string to Supabase.
   * Found in: Supabase Dashboard → Settings → Database → Connection string
   */
  databaseUrl: optional(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/postgres',
  ),
} as const;
