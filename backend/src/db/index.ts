import { Pool, PoolClient } from 'pg';
import { config } from '../config';

export const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export async function initializeDatabase(): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email       VARCHAR(255) UNIQUE NOT NULL,
        username    VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  VARCHAR(64) NOT NULL UNIQUE,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS documents (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title       VARCHAR(500) NOT NULL DEFAULT 'Untitled Document',
        is_public   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS document_collaborators (
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission  VARCHAR(10) NOT NULL DEFAULT 'edit'
                    CHECK (permission IN ('view', 'edit')),
        added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (document_id, user_id)
      );

      -- Stores raw Yjs binary updates for each document.
      -- On load, all updates are merged via Y.applyUpdate to reconstruct state.
      -- A periodic compaction job (not implemented here) can merge old rows.
      CREATE TABLE IF NOT EXISTS document_updates (
        id          BIGSERIAL PRIMARY KEY,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        update_data BYTEA NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_doc_updates_doc_id
        ON document_updates(document_id, id ASC);

      CREATE INDEX IF NOT EXISTS idx_documents_owner
        ON documents(owner_id, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
        ON refresh_tokens(user_id, expires_at);
    `);

    await client.query('COMMIT');
    console.log('[db] Schema initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
