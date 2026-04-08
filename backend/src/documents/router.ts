import { Router, Response } from 'express';
import {
  createDocument,
  getUserDocuments,
  getDocument,
  updateDocumentTitle,
  deleteDocument,
  addCollaborator,
} from './service';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';

const router = Router();
router.use(requireAuth);

// POST /api/documents
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
    const doc = await createDocument(req.user!.userId, title);
    res.status(201).json(doc);
  } catch (err) {
    console.error('[documents/create]', err);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// GET /api/documents
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const docs = await getUserDocuments(req.user!.userId);
    res.json(docs);
  } catch (err) {
    console.error('[documents/list]', err);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// GET /api/documents/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const doc = await getDocument(req.params.id, req.user!.userId);
    if (!doc) {
      res.status(404).json({ error: 'Document not found or access denied' });
      return;
    }
    res.json(doc);
  } catch (err) {
    console.error('[documents/get]', err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// PATCH /api/documents/:id/title
router.patch('/:id/title', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { title } = req.body ?? {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  try {
    const doc = await updateDocumentTitle(req.params.id, req.user!.userId, title.trim());
    if (!doc) {
      res.status(404).json({ error: 'Document not found or access denied' });
      return;
    }
    res.json(doc);
  } catch (err) {
    console.error('[documents/updateTitle]', err);
    res.status(500).json({ error: 'Failed to update title' });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deleted = await deleteDocument(req.params.id, req.user!.userId);
    if (!deleted) {
      res.status(404).json({ error: 'Document not found or access denied' });
      return;
    }
    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('[documents/delete]', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// POST /api/documents/:id/collaborators
router.post('/:id/collaborators', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { email, permission } = req.body ?? {};

  if (!email || !permission) {
    res.status(400).json({ error: 'email and permission are required' });
    return;
  }
  if (!['view', 'edit'].includes(permission)) {
    res.status(400).json({ error: 'permission must be "view" or "edit"' });
    return;
  }

  try {
    await addCollaborator(req.params.id, req.user!.userId, String(email), permission);
    res.json({ message: 'Collaborator added' });
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    if (e.code === 'FORBIDDEN' || e.code === 'NOT_FOUND') {
      res.status(400).json({ error: e.message });
    } else {
      console.error('[documents/addCollaborator]', err);
      res.status(500).json({ error: 'Failed to add collaborator' });
    }
  }
});

export { router as documentsRouter };
