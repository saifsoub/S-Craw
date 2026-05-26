import { createUserClient } from '../db';

export interface Document {
  id: string;
  owner_id: string;
  title: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** PostgREST represents BYTEA as `\x<hex>`. Convert Uint8Array → that format. */
function toHex(data: Uint8Array): string {
  return '\\x' + Buffer.from(data).toString('hex');
}

/** Convert PostgREST BYTEA `\x<hex>` → Buffer. */
function fromHex(hex: string): Buffer {
  return Buffer.from(hex.startsWith('\\x') ? hex.slice(2) : hex, 'hex');
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createDocument(
  accessToken: string,
  ownerId: string,
  title = 'Untitled Document',
): Promise<Document> {
  const db = createUserClient(accessToken);
  const { data, error } = await db
    .from('documents')
    .insert({ owner_id: ownerId, title })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Document;
}

export async function getUserDocuments(accessToken: string): Promise<Document[]> {
  const db = createUserClient(accessToken);
  const { data, error } = await db
    .from('documents')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Document[];
}

export async function getDocument(
  accessToken: string,
  documentId: string,
): Promise<Document | null> {
  const db = createUserClient(accessToken);
  const { data, error } = await db
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) return null;
  return data as Document;
}

export async function updateDocumentTitle(
  accessToken: string,
  documentId: string,
  title: string,
): Promise<Document | null> {
  const db = createUserClient(accessToken);
  const { data, error } = await db
    .from('documents')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', documentId)
    .select()
    .single();

  if (error) return null;
  return data as Document;
}

export async function deleteDocument(
  accessToken: string,
  documentId: string,
): Promise<boolean> {
  const db = createUserClient(accessToken);
  const { error } = await db
    .from('documents')
    .delete()
    .eq('id', documentId);

  return !error;
}

export async function addCollaborator(
  accessToken: string,
  documentId: string,
  collaboratorEmail: string,
  permission: 'view' | 'edit',
): Promise<void> {
  const db = createUserClient(accessToken);

  // Look up user ID by email via SECURITY DEFINER function
  const { data: userId, error: lookupError } = await db
    .rpc('find_user_id_by_email', { email_input: collaboratorEmail });

  if (lookupError || !userId) {
    throw Object.assign(new Error('No user found with that email'), { code: 'NOT_FOUND' });
  }

  const { error } = await db
    .from('document_collaborators')
    .upsert({ document_id: documentId, user_id: userId, permission });

  if (error) {
    throw Object.assign(new Error('Not authorized to manage collaborators'), { code: 'FORBIDDEN' });
  }
}

// ─── Yjs Persistence ──────────────────────────────────────────────────────────

/**
 * Persist a Yjs binary update.
 * Uses the admin client (anon key) for performance — RLS on document_updates
 * INSERT policy still enforces authorization via the document ownership check.
 * We pass the user's token so the policy can resolve auth.uid().
 */
export async function persistDocumentUpdate(
  accessToken: string,
  documentId: string,
  update: Uint8Array,
): Promise<void> {
  const db = createUserClient(accessToken);
  await db.from('document_updates').insert({
    document_id: documentId,
    update_data: toHex(update),
  });
  await db.from('documents')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', documentId);
}

/**
 * Load all persisted Yjs updates for a document in order.
 * The caller merges them via Y.applyUpdate to reconstruct state.
 */
export async function getDocumentUpdates(
  accessToken: string,
  documentId: string,
): Promise<Buffer[]> {
  const db = createUserClient(accessToken);
  const { data, error } = await db
    .from('document_updates')
    .select('update_data')
    .eq('document_id', documentId)
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { update_data: string }) => fromHex(row.update_data));
}
