import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { Awareness } from 'y-protocols/awareness';
import { useAuthStore } from '../store/authStore';
import type { CollaboratorPresence } from '../types';

/** Deterministic color derived from username — consistent across page reloads */
function userColor(username: string): string {
  const palette = [
    '#e57373', '#f06292', '#ba68c8', '#7986cb',
    '#4db6ac', '#81c784', '#ffb74d', '#ff8a65',
    '#90a4ae', '#4fc3f7',
  ];
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (h << 5) - h + username.charCodeAt(i);
    h |= 0;
  }
  return palette[Math.abs(h) % palette.length];
}

const WS_BASE =
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}/ws`
    : `ws://${window.location.host}/ws`;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface CollaborationHandle {
  ydoc: Y.Doc | null;
  ytext: Y.Text | null;
  awareness: Awareness | null;
  collaborators: CollaboratorPresence[];
  connectionStatus: ConnectionStatus;
}

export function useCollaboration(documentId: string | null): CollaborationHandle {
  const { accessToken, user } = useAuthStore();
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  // Stable ref so event callbacks never close over stale state
  const handleRef = useRef<{
    ydoc: Y.Doc | null;
    ytext: Y.Text | null;
    awareness: Awareness | null;
    provider: WebsocketProvider | null;
  }>({ ydoc: null, ytext: null, awareness: null, provider: null });

  const teardown = useCallback(() => {
    const { provider, ydoc } = handleRef.current;
    if (provider) {
      provider.disconnect();
      provider.destroy();
    }
    if (ydoc) ydoc.destroy();
    handleRef.current = { ydoc: null, ytext: null, awareness: null, provider: null };
    setCollaborators([]);
    setConnectionStatus('disconnected');
  }, []);

  useEffect(() => {
    if (!documentId || !accessToken || !user) {
      teardown();
      return;
    }

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('content');

    /**
     * y-websocket WebsocketProvider appends `/${roomName}` to the server URL
     * and adds `params` as query string parameters. Resulting URL:
     *   ws://host/ws/<documentId>?token=<accessToken>
     */
    const provider = new WebsocketProvider(WS_BASE, documentId, ydoc, {
      connect: true,
      params: { token: accessToken },
    });

    const { awareness } = provider;
    const color = userColor(user.username);

    awareness.setLocalStateField('user', {
      userId: user.userId,
      username: user.username,
      color,
    });

    provider.on('status', ({ status }: { status: string }) => {
      setConnectionStatus(status === 'connected' ? 'connected' : 'connecting');
    });

    const syncHandler = (isSynced: boolean) => {
      if (isSynced) setConnectionStatus('connected');
    };
    provider.on('sync', syncHandler);

    const awarenessHandler = () => {
      const states = awareness.getStates();
      const seen = new Set<string>();
      const present: CollaboratorPresence[] = [];

      states.forEach((state) => {
        if (!state?.user) return;
        const u = state.user as CollaboratorPresence;
        if (!seen.has(u.userId)) {
          seen.add(u.userId);
          present.push(u);
        }
      });
      setCollaborators(present);
    };

    awareness.on('change', awarenessHandler);
    setConnectionStatus('connecting');

    handleRef.current = { ydoc, ytext, awareness, provider };

    return () => {
      awareness.off('change', awarenessHandler);
      provider.off('sync', syncHandler);
      teardown();
    };
  }, [documentId, accessToken, user, teardown]);

  return {
    ...handleRef.current,
    collaborators,
    connectionStatus,
  };
}
