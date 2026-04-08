/**
 * WebSocket handler implementing the y-websocket binary protocol.
 *
 * Protocol summary (y-protocols):
 *   msg type 0 = sync
 *     subtype 0 = SyncStep1: client → server  { stateVector }
 *     subtype 1 = SyncStep2: server → client  { update }
 *     subtype 2 = YjsUpdate: bidirectional    { update }
 *   msg type 1 = awareness: bidirectional     { awarenessUpdate }
 *
 * Auth: token is passed as a query param by the y-websocket WebsocketProvider.
 * URL shape: /ws/<documentId>?token=<accessToken>
 *
 * Connection lifecycle:
 *   1. Verify token → check document access
 *   2. Get or create in-memory Y.Doc (loaded from persisted DB updates)
 *   3. Send SyncStep1 to bootstrap the client
 *   4. Relay updates and awareness between all clients in the same room
 *   5. Persist updates to DB (debounced, 2 s after last write)
 *   6. On last client disconnect → final persist + room cleanup
 */

import http from 'http';
import { URL } from 'url';
import WebSocket, { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { verifyAccessToken } from '../auth/service';
import { getDocument, getDocumentUpdates, persistDocumentUpdate } from '../documents/service';

// ─── Message type constants (mirrors y-protocols) ────────────────────────────
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// ─── Room management ─────────────────────────────────────────────────────────

interface ClientMeta {
  userId: string;
  username: string;
}

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Map<WebSocket, ClientMeta>;
  /** Timer for debounced DB persistence */
  persistTimer: ReturnType<typeof setTimeout> | null;
  /** Tracks whether there are unsaved changes since the last persist */
  dirty: boolean;
}

const rooms = new Map<string, Room>();

async function getOrCreateRoom(documentId: string): Promise<Room> {
  const existing = rooms.get(documentId);
  if (existing) return existing;

  const ydoc = new Y.Doc({ gc: true });

  // Reconstruct document state from all persisted binary updates
  const updates = await getDocumentUpdates(documentId);
  if (updates.length > 0) {
    Y.transact(ydoc, () => {
      for (const buf of updates) {
        Y.applyUpdate(ydoc, new Uint8Array(buf));
      }
    }, 'load', false);
  }

  const awareness = new awarenessProtocol.Awareness(ydoc);

  const room: Room = {
    doc: ydoc,
    awareness,
    clients: new Map(),
    persistTimer: null,
    dirty: false,
  };

  // Debounce persistence: write to DB 2 s after the last update burst
  ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    // Don't re-persist updates that came from our own 'load' transaction
    if (origin === 'load') return;

    room.dirty = true;
    if (room.persistTimer) clearTimeout(room.persistTimer);
    room.persistTimer = setTimeout(async () => {
      room.persistTimer = null;
      if (!room.dirty) return;
      room.dirty = false;
      try {
        const snapshot = Y.encodeStateAsUpdate(room.doc);
        await persistDocumentUpdate(documentId, snapshot);
      } catch (err) {
        console.error(`[ws] Failed to persist update for doc ${documentId}:`, err);
      }
    }, 2_000);
  });

  rooms.set(documentId, room);
  console.log(`[ws] Room created: ${documentId}`);
  return room;
}

function scheduleRoomCleanup(documentId: string): void {
  // Wait a few seconds in case the last client reconnects immediately
  setTimeout(() => {
    const room = rooms.get(documentId);
    if (!room || room.clients.size > 0) return;

    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
      room.persistTimer = null;
    }

    // Final persist of the full document state
    if (room.dirty) {
      const snapshot = Y.encodeStateAsUpdate(room.doc);
      persistDocumentUpdate(documentId, snapshot).catch((err) =>
        console.error(`[ws] Final persist failed for doc ${documentId}:`, err),
      );
    }

    room.awareness.destroy();
    rooms.delete(documentId);
    console.log(`[ws] Room cleaned up: ${documentId}`);
  }, 5_000);
}

// ─── Message helpers ──────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(msg, (err) => {
      if (err) console.error('[ws] send error:', err.message);
    });
  }
}

function broadcast(room: Room, msg: Uint8Array, except?: WebSocket): void {
  room.clients.forEach((_, client) => {
    if (client !== except) send(client, msg);
  });
}

// ─── WebSocket server setup ───────────────────────────────────────────────────

export function setupWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
    // ── 1. Parse URL ──────────────────────────────────────────────────────────
    // URL shape produced by y-websocket WebsocketProvider + params: { token }:
    //   /ws/<documentId>?token=<accessToken>
    let documentId: string;
    let token: string | null;

    try {
      const reqUrl = new URL(req.url ?? '/', 'http://placeholder');
      const parts = reqUrl.pathname.split('/').filter(Boolean);
      documentId = parts[1] ?? ''; // parts[0] = 'ws', parts[1] = documentId
      token = reqUrl.searchParams.get('token');
    } catch {
      ws.close(4000, 'Malformed request URL');
      return;
    }

    if (!documentId || !token) {
      ws.close(4001, 'Missing documentId or token');
      return;
    }

    // ── 2. Authenticate ───────────────────────────────────────────────────────
    let userPayload: { userId: string; email: string; username: string };
    try {
      userPayload = verifyAccessToken(token);
    } catch {
      ws.close(4001, 'Invalid or expired access token');
      return;
    }

    // ── 3. Authorize (document access check) ─────────────────────────────────
    try {
      const doc = await getDocument(documentId, userPayload.userId);
      if (!doc) {
        ws.close(4003, 'Document not found or access denied');
        return;
      }
    } catch {
      ws.close(4003, 'Authorization check failed');
      return;
    }

    // ── 4. Join room ──────────────────────────────────────────────────────────
    const room = await getOrCreateRoom(documentId);
    room.clients.set(ws, { userId: userPayload.userId, username: userPayload.username });
    console.log(
      `[ws] Client joined: user=${userPayload.username} doc=${documentId} (${room.clients.size} connected)`,
    );

    // ── 5. Bootstrap: SyncStep1 ───────────────────────────────────────────────
    // Server sends its current state vector so the client can reply with
    // the updates the server is missing.
    {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SYNC);
      syncProtocol.writeSyncStep1(enc, room.doc);
      send(ws, encoding.toUint8Array(enc));
    }

    // Also send current awareness states to the new client
    {
      const states = room.awareness.getStates();
      if (states.size > 0) {
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MSG_AWARENESS);
        encoding.writeVarUint8Array(
          enc,
          awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys())),
        );
        send(ws, encoding.toUint8Array(enc));
      }
    }

    // ── 6. Message handler ────────────────────────────────────────────────────
    ws.on('message', (rawData: Buffer | ArrayBuffer | Buffer[]) => {
      const data = Buffer.isBuffer(rawData)
        ? rawData
        : Buffer.from(rawData as ArrayBuffer);

      try {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const msgType = decoding.readVarUint(decoder);

        switch (msgType) {
          case MSG_SYNC: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MSG_SYNC);

            const syncMsgType = syncProtocol.readSyncMessage(
              decoder,
              encoder,
              room.doc,
              ws,
            );

            // Send SyncStep2 back to the connecting client (if we produced one)
            if (encoding.length(encoder) > 1) {
              send(ws, encoding.toUint8Array(encoder));
            }

            // Broadcast the update to all other clients in the room
            if (
              syncMsgType === syncProtocol.messageYjsSyncStep2 ||
              syncMsgType === syncProtocol.messageYjsUpdate
            ) {
              broadcast(room, new Uint8Array(data), ws);
            }
            break;
          }

          case MSG_AWARENESS: {
            const update = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);

            // Relay awareness update to all other clients
            const fwd = encoding.createEncoder();
            encoding.writeVarUint(fwd, MSG_AWARENESS);
            encoding.writeVarUint8Array(fwd, update);
            broadcast(room, encoding.toUint8Array(fwd), ws);
            break;
          }

          default:
            console.warn(`[ws] Unknown message type: ${msgType}`);
        }
      } catch (err) {
        console.error(`[ws] Error processing message for doc ${documentId}:`, err);
      }
    });

    // ── 7. Disconnect handler ─────────────────────────────────────────────────
    ws.on('close', () => {
      room.clients.delete(ws);

      // Broadcast awareness removal to remaining clients
      awarenessProtocol.removeAwarenessStates(room.awareness, [room.doc.clientID], 'disconnect');
      const awarenessMsg = encoding.createEncoder();
      encoding.writeVarUint(awarenessMsg, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessMsg,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, [room.doc.clientID]),
      );
      broadcast(room, encoding.toUint8Array(awarenessMsg));

      console.log(
        `[ws] Client left: user=${userPayload.username} doc=${documentId} (${room.clients.size} remaining)`,
      );

      if (room.clients.size === 0) {
        scheduleRoomCleanup(documentId);
      }
    });

    ws.on('error', (err) => {
      console.error(`[ws] Socket error for doc ${documentId}:`, err.message);
    });
  });

  wss.on('error', (err) => {
    console.error('[wss] Server error:', err);
  });

  return wss;
}
