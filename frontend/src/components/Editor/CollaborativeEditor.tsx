/**
 * CollaborativeEditor
 *
 * Mounts a CodeMirror 6 instance bound to a Yjs Y.Text via y-codemirror.next.
 * The Yjs document is connected to the backend WebSocket room.
 *
 * Key design decisions:
 *  - EditorView is created imperatively (not via @uiw/react-codemirror)
 *    so we have full control over its lifecycle and Yjs extension wiring.
 *  - The editor is torn down and re-created any time the Yjs handles change
 *    (i.e., when documentId changes or the connection resets).
 *  - yCollab handles CRDT sync, cursor awareness, and per-user undo stacks.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { yCollab } from 'y-codemirror.next';
import { useCollaboration } from '../../hooks/useCollaboration';
import { useDocument, useUpdateDocumentTitle } from '../../hooks/useDocument';
import { EditorToolbar } from './EditorToolbar';
import { PresenceIndicator } from './PresenceIndicator';
import { ShareModal } from './ShareModal';

interface Props {
  documentId: string;
}

export function CollaborativeEditor({ documentId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const [showShare, setShowShare] = useState(false);

  // Force re-render when the view is ready so toolbar gets a ref
  const [, setEditorReady] = useState(false);

  const { data: document } = useDocument(documentId);
  const { mutate: updateTitle } = useUpdateDocumentTitle();
  const { ydoc, ytext, awareness, collaborators, connectionStatus } = useCollaboration(documentId);

  useEffect(() => {
    if (!containerRef.current || !ydoc || !ytext || !awareness) return;

    // Destroy previous editor before creating a new one
    editorViewRef.current?.destroy();
    editorViewRef.current = null;

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        oneDark,
        /**
         * yCollab wires the Y.Text to CodeMirror's transaction pipeline:
         *  - Local edits → Yjs updates → broadcast via WebSocket
         *  - Remote Yjs updates → CodeMirror transactions
         *  - Awareness (cursors, selections) → remote cursor overlays
         *  - undoManager: true → per-user undo/redo via Y.UndoManager
         */
        yCollab(ytext, awareness),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%', fontSize: '15px' },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          },
          '.cm-content': { padding: '20px 24px' },
          // Remote cursor label style (injected by y-codemirror.next)
          '.cm-ySelectionInfo': {
            position: 'absolute',
            top: '-1.4em',
            left: '-1px',
            fontSize: '10px',
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            lineHeight: 'normal',
            userSelect: 'none',
            color: 'white',
            padding: '1px 4px',
            borderRadius: '3px 3px 3px 0',
            whiteSpace: 'nowrap',
            zIndex: 10,
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    editorViewRef.current = view;
    setEditorReady(true); // notify toolbar

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [ydoc, ytext, awareness]);

  const handleTitleChange = useCallback(
    (newTitle: string) => updateTitle({ id: documentId, title: newTitle }),
    [documentId, updateTitle],
  );

  return (
    <div className="editor-layout">
      <EditorToolbar
        editorView={editorViewRef.current}
        title={document?.title ?? 'Loading…'}
        onTitleChange={handleTitleChange}
        onShareClick={() => setShowShare(true)}
      />

      <div className="editor-top-bar">
        <PresenceIndicator collaborators={collaborators} connectionStatus={connectionStatus} />
      </div>

      {/* CodeMirror mounts here */}
      <div className="editor-content" ref={containerRef} />

      {showShare && (
        <ShareModal documentId={documentId} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
