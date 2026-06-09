import { useState, FormEvent, useEffect, useRef } from 'react';
import { useAddCollaborator } from '../../hooks/useDocument';

interface Props {
  documentId: string;
  onClose: () => void;
}

export function ShareModal({ documentId, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'edit' | 'view'>('edit');
  const [successMsg, setSuccessMsg] = useState('');
  const { mutate: addCollaborator, isPending, error } = useAddCollaborator();
  const firstFocusRef = useRef<HTMLInputElement>(null);

  // Auto-focus first input and trap Escape
  useEffect(() => {
    firstFocusRef.current?.focus();
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    addCollaborator(
      { documentId, email, permission },
      {
        onSuccess: () => {
          setSuccessMsg(`Invited ${email} as ${permission === 'edit' ? 'editor' : 'viewer'}`);
          setEmail('');
        },
      },
    );
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="share-modal-title">Share Document</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <p className="modal-description">Invite people to view or edit this document.</p>

        {error && <div className="error-banner" role="alert">{error.message}</div>}
        {successMsg && <div className="success-banner" role="status">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="share-form" noValidate>
          <div className="form-group">
            <label htmlFor="share-email">Email address</label>
            <input
              id="share-email"
              ref={firstFocusRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collaborator@example.com"
              required
              disabled={isPending}
            />
          </div>

          <div className="form-group">
            <label htmlFor="share-permission">Permission</label>
            <select
              id="share-permission"
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'edit' | 'view')}
              disabled={isPending}
            >
              <option value="edit">Can edit</option>
              <option value="view">Can view</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? 'Sending invite…' : 'Send invite'}
          </button>
        </form>
      </div>
    </div>
  );
}
