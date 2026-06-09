import { useNavigate } from 'react-router-dom';
import { useDocuments, useCreateDocument, useDeleteDocument } from '../../hooks/useDocument';
import type { Document } from '../../types';

export function DocumentList() {
  const navigate = useNavigate();
  const { data: documents, isLoading, error } = useDocuments();
  const { mutate: createDocument, isPending: isCreating } = useCreateDocument();
  const { mutate: deleteDocument } = useDeleteDocument();

  const handleCreate = () => {
    createDocument(undefined, {
      onSuccess: (doc: Document) => navigate(`/document/${doc.id}`),
    });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this document? This action cannot be undone.')) {
      deleteDocument(id);
    }
  };

  if (isLoading) {
    return (
      <div className="documents-loading" role="status" aria-label="Loading documents">
        <div className="spinner" />
        <p>Loading documents…</p>
      </div>
    );
  }

  if (error) {
    return <div className="error-banner">{error.message}</div>;
  }

  return (
    <div className="document-list">
      <div className="document-list-header">
        <h2>My Documents</h2>
        <button className="btn btn-primary" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? 'Creating…' : '+ New Document'}
        </button>
      </div>

      {!documents?.length ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">📄</div>
          <h3>No documents yet</h3>
          <p>Create your first document to start writing and collaborating.</p>
          <button className="btn btn-primary" onClick={handleCreate}>
            Create Document
          </button>
        </div>
      ) : (
        <ul className="documents-grid" role="list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <div
                className="document-card"
                onClick={() => navigate(`/document/${doc.id}`)}
                role="button"
                tabIndex={0}
                aria-label={`Open document: ${doc.title}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') navigate(`/document/${doc.id}`);
                }}
              >
                <div className="document-card-icon" aria-hidden="true">📝</div>
                <div className="document-card-content">
                  <span className="document-card-title">{doc.title}</span>
                  <time
                    className="document-card-date"
                    dateTime={doc.updated_at}
                    title={new Date(doc.updated_at).toLocaleString()}
                  >
                    {new Date(doc.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </div>
                <button
                  className="document-card-delete"
                  onClick={(e) => handleDelete(e, doc.id)}
                  aria-label={`Delete ${doc.title}`}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
