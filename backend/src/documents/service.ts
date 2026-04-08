import { pool } from '../db';

export interface Document {
  id: string;
  owner_id: string;
  title: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createDocument(ownerId: string, title = 'Untitled Document'): Promise<Document> {
  const result = await pool.query<Document>(
    `INSERT INTO documents (owner_id, title) VALUES ($1, $2) RETURNING *`,
    [ownerId, title],
  );
  return result.rows[0];
}

export async function getUserDocuments(userId: string): Promise<Document[]> {
  const result = await pool.query<Document>(
    `SELECT DISTINCT d.*
     FROM documents d
     LEFT JOIN document_collaborators dc ON dc.document_id = d.id
     WHERE d.owner_id = $1 OR dc.user_id = $1
     ORDER BY d.updated_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getDocument(documentId: string, userId: string): Promise<Document | null> {
  const result = await pool.query<Document>(
    `SELECT d.*
     FROM documents d
     WHERE d.id = $1
       AND (
         d.owner_id = $2
         OR d.is_public = TRUE
         OR EXISTS (
           SELECT 1 FROM document_collaborators dc
           WHERE dc.document_id = d.id AND dc.user_id = $2
         )
       )`,
    [documentId, userId],
  );
  return result.rows[0] ?? null;
}

export async function updateDocumentTitle(
  documentId: string,
  userId: string,
  title: string,
): Promise<Document | null> {
  const result = await pool.query<Document>(
    `UPDATE documents
     SET title = $1, updated_at = NOW()
     WHERE id = $2
       AND (
         owner_id = $3
         OR EXISTS (
           SELECT 1 FROM document_collaborators dc
           WHERE dc.document_id = documents.id
             AND dc.user_id = $3
             AND dc.permission = 'edit'
         )
       )
     RETURNING *`,
    [title, documentId, userId],
  );
  return result.rows[0] ?? null;
}

export async function deleteDocument(documentId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM documents WHERE id = $1 AND owner_id = $2`,
    [documentId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function addCollaborator(
  documentId: string,
  ownerId: string,
  collaboratorEmail: string,
  permission: 'view' | 'edit',
): Promise<void> {
  const ownerCheck = await pool.query(
    'SELECT id FROM documents WHERE id = $1 AND owner_id = $2',
    [documentId, ownerId],
  );
  if (ownerCheck.rows.length === 0) {
    throw Object.assign(new Error('Not authorized to manage collaborators'), { code: 'FORBIDDEN' });
  }

  const userRow = await pool.query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [collaboratorEmail.toLowerCase()],
  );
  if (userRow.rows.length === 0) {
    throw Object.assign(new Error('No user found with that email'), { code: 'NOT_FOUND' });
  }

  // Upsert: allow updating permission if already a collaborator
  await pool.query(
    `INSERT INTO document_collaborators (document_id, user_id, permission)
     VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE SET permission = EXCLUDED.permission`,
    [documentId, userRow.rows[0].id, permission],
  );
}

// ─── Yjs Persistence ─────────────────────────────────────────────────────────

/**
 * Persist a Yjs binary update to the database.
 * Updates accumulate and are merged on load.  A background compaction
 * job (outside this module) should periodically merge them.
 */
export async function persistDocumentUpdate(
  documentId: string,
  update: Uint8Array,
): Promise<void> {
  const buf = Buffer.from(update);
  await pool.query(
    `INSERT INTO document_updates (document_id, update_data) VALUES ($1, $2)`,
    [documentId, buf],
  );
  // Bump the document's updated_at for ordering in the list view
  await pool.query(
    `UPDATE documents SET updated_at = NOW() WHERE id = $1`,
    [documentId],
  );
}

/**
 * Load all persisted Yjs update binaries for a document in insertion order.
 * The caller applies them via Y.applyUpdate to reconstruct the document.
 */
export async function getDocumentUpdates(documentId: string): Promise<Buffer[]> {
  const result = await pool.query<{ update_data: Buffer }>(
    `SELECT update_data FROM document_updates WHERE document_id = $1 ORDER BY id ASC`,
    [documentId],
  );
  return result.rows.map((r) => r.update_data);
}
