import type { CollaboratorPresence } from '../../types';
import type { ConnectionStatus } from '../../hooks/useCollaboration';

interface Props {
  collaborators: CollaboratorPresence[];
  connectionStatus: ConnectionStatus;
}

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  connected: '#22c55e',
  connecting: '#f59e0b',
  disconnected: '#ef4444',
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: 'Live',
  connecting: 'Connecting…',
  disconnected: 'Offline',
};

export function PresenceIndicator({ collaborators, connectionStatus }: Props) {
  return (
    <div className="presence-indicator" aria-live="polite" aria-atomic="false">
      <div className="connection-status" title={STATUS_LABEL[connectionStatus]}>
        <span
          className="status-dot"
          style={{ backgroundColor: STATUS_COLOR[connectionStatus] }}
          aria-hidden="true"
        />
        <span className="status-label">{STATUS_LABEL[connectionStatus]}</span>
      </div>

      {collaborators.length > 0 && (
        <div
          className="collaborators-list"
          aria-label={`${collaborators.length} collaborator${collaborators.length > 1 ? 's' : ''} online`}
        >
          {collaborators.slice(0, 6).map((c) => (
            <div
              key={c.userId}
              className="collaborator-avatar"
              style={{ backgroundColor: c.color }}
              title={c.username}
              aria-label={c.username}
            >
              {c.username.charAt(0).toUpperCase()}
            </div>
          ))}
          {collaborators.length > 6 && (
            <div className="collaborator-avatar collaborator-overflow" aria-hidden="true">
              +{collaborators.length - 6}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
