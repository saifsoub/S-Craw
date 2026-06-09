import { useState, KeyboardEvent } from 'react';
import type { EditorView } from '@codemirror/view';

interface Props {
  editorView: EditorView | null;
  title: string;
  onTitleChange: (title: string) => void;
  onShareClick: () => void;
}

interface MarkdownAction {
  label: string;
  title: string;
  wrap?: [string, string];
  linePrefix?: string;
}

const ACTIONS: MarkdownAction[] = [
  { label: 'B',     title: 'Bold',           wrap: ['**', '**'] },
  { label: 'I',     title: 'Italic',         wrap: ['_', '_'] },
  { label: 'S',     title: 'Strikethrough',  wrap: ['~~', '~~'] },
  { label: 'H1',    title: 'Heading 1',      linePrefix: '# ' },
  { label: 'H2',    title: 'Heading 2',      linePrefix: '## ' },
  { label: 'H3',    title: 'Heading 3',      linePrefix: '### ' },
  { label: '`',     title: 'Inline code',    wrap: ['`', '`'] },
  { label: '```',   title: 'Code block',     wrap: ['```\n', '\n```'] },
  { label: '• List',title: 'Bullet list',    linePrefix: '- ' },
  { label: '1. List',title:'Numbered list',  linePrefix: '1. ' },
  { label: '> Quote',title:'Blockquote',     linePrefix: '> ' },
];

export function EditorToolbar({ editorView, title, onTitleChange, onShareClick }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);

  const applyAction = (action: MarkdownAction) => {
    if (!editorView) return;
    const { state, dispatch } = editorView;
    const { from, to } = state.selection.main;
    const selected = state.sliceDoc(from, to);

    if (action.wrap) {
      const [pre, suf] = action.wrap;
      const replacement = selected ? `${pre}${selected}${suf}` : `${pre}text${suf}`;
      dispatch(
        state.update({
          changes: { from, to, insert: replacement },
          selection: selected
            ? { anchor: from, head: from + replacement.length }
            : { anchor: from + pre.length, head: from + pre.length + 4 },
        }),
      );
    } else if (action.linePrefix) {
      const line = state.doc.lineAt(from);
      dispatch(state.update({ changes: { from: line.from, insert: action.linePrefix } }));
    }

    editorView.focus();
  };

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== title) onTitleChange(trimmed);
    else setLocalTitle(title);
  };

  const handleTitleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitTitle();
    if (e.key === 'Escape') { setLocalTitle(title); setEditingTitle(false); }
  };

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Markdown editor toolbar">
      {/* Document title */}
      <div className="toolbar-title">
        {editingTitle ? (
          <input
            className="title-input"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleTitleKey}
            aria-label="Document title"
            autoFocus
          />
        ) : (
          <button
            className="title-display"
            onClick={() => { setLocalTitle(title); setEditingTitle(true); }}
            title="Click to rename"
            aria-label={`Document title: ${title}. Click to edit.`}
          >
            {title}
          </button>
        )}
      </div>

      {/* Formatting actions */}
      <div className="toolbar-actions">
        {ACTIONS.map((action) => (
          <button
            key={action.title}
            className="toolbar-btn"
            title={action.title}
            aria-label={action.title}
            onClick={() => applyAction(action)}
            disabled={!editorView}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Right: share */}
      <div className="toolbar-right">
        <button className="btn btn-secondary" onClick={onShareClick} type="button">
          Share
        </button>
      </div>
    </div>
  );
}
