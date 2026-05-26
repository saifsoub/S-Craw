import { Pool } from 'pg';
import { config } from '../config';

/**
 * PostgreSQL connection pool pointing at Supabase.
 * Schema is managed via Supabase migrations — no DDL runs here.
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: config.databaseUrl.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err);
});

export async function checkDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[db] Connected to Supabase PostgreSQL');
  } finally {
    client.release();
  }
}
