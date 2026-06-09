import http from 'http';
import { URL } from 'url';
import WebSocket, { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { verifyToken } from '../auth/middleware';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// ─── Room management ──────────────────────────────────────────────────────────

interface ClientMeta {
  userId: string;
  username: string;
  accessToken: string;
}

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Map<WebSocket, ClientMeta>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
  loaderToken: string;
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(documentId: string): Room {
  const existing = rooms.get(documentId);
  if (existing) return existing;

  const ydoc = new Y.Doc({ gc: true });
  const awareness = new awarenessProtocol.Awareness(ydoc);

  const room: Room = {
    doc: ydoc,
    awareness,
    clients: new Map(),
    persistTimer: null,
    dirty: false,
    loaderToken: '',
  };

  rooms.set(documentId, room);
  console.log(`[ws] Room created: ${documentId}`);
  return room;
}

function scheduleRoomCleanup(documentId: string): void {
  setTimeout(() => {
    const room = rooms.get(documentId);
    if (!room || room.clients.size > 0) return;
    if (room.persistTimer) clearTimeout(room.persistTimer);
    room.awareness.destroy();
    rooms.delete(documentId);
    console.log(`[ws] Room cleaned up: ${documentId}`);
  }, 5_000);
}

// ─── Messaging ────────────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(msg, (err) => { if (err) console.error('[ws] send error:', err.message); });
  }
}

function broadcast(room: Room, msg: Uint8Array, except?: WebSocket): void {
  room.clients.forEach((_, client) => { if (client !== except) send(client, msg); });
}

// ─── WebSocket server ─────────────────────────────────────────────────────────

export function setupWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
    // ── Parse URL: /ws/<documentId>?token=<supabase-access-token> ─────────────
    let documentId: string;
    let token: string | null;

    try {
      const reqUrl = new URL(req.url ?? '/', 'http://placeholder');
      const parts = reqUrl.pathname.split('/').filter(Boolean);
      documentId = parts[1] ?? '';
      token = reqUrl.searchParams.get('token');
    } catch {
      ws.close(4000, 'Malformed request URL');
      return;
    }

    if (!documentId || !token) {
      ws.close(4001, 'Missing documentId or token');
      return;
    }

    // ── Authenticate via Supabase Auth ────────────────────────────────────────
    let userPayload: { userId: string; email: string; username: string };
    try {
      userPayload = await verifyToken(token);
    } catch {
      ws.close(4001, 'Invalid or expired access token');
      return;
    }

    // ── Join room ─────────────────────────────────────────────────────────────
    const room = getOrCreateRoom(documentId);
    room.clients.set(ws, { ...userPayload, accessToken: token });
    console.log(`[ws] ${userPayload.username} joined doc=${documentId} (${room.clients.size} online)`);

    // ── Bootstrap: SyncStep1 ──────────────────────────────────────────────────
    {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SYNC);
      syncProtocol.writeSyncStep1(enc, room.doc);
      send(ws, encoding.toUint8Array(enc));
    }

    // Send current awareness states to the new client
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

    // ── Message handler ───────────────────────────────────────────────────────
    ws.on('message', (rawData: Buffer | ArrayBuffer | Buffer[]) => {
      const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData as ArrayBuffer);
      try {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const msgType = decoding.readVarUint(decoder);

        if (msgType === MSG_SYNC) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          const syncMsgType = syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
          if (encoding.length(encoder) > 1) send(ws, encoding.toUint8Array(encoder));
          if (
            syncMsgType === syncProtocol.messageYjsSyncStep2 ||
            syncMsgType === syncProtocol.messageYjsUpdate
          ) {
            broadcast(room, new Uint8Array(data), ws);
          }
        } else if (msgType === MSG_AWARENESS) {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
          const fwd = encoding.createEncoder();
          encoding.writeVarUint(fwd, MSG_AWARENESS);
          encoding.writeVarUint8Array(fwd, update);
          broadcast(room, encoding.toUint8Array(fwd), ws);
        }
      } catch (err) {
        console.error(`[ws] Message error for doc ${documentId}:`, err);
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    ws.on('close', () => {
      room.clients.delete(ws);
      awarenessProtocol.removeAwarenessStates(room.awareness, [room.doc.clientID], 'disconnect');
      const msg = encoding.createEncoder();
      encoding.writeVarUint(msg, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        msg,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, [room.doc.clientID]),
      );
      broadcast(room, encoding.toUint8Array(msg));
      console.log(`[ws] ${userPayload.username} left doc=${documentId} (${room.clients.size} remaining)`);
      if (room.clients.size === 0) scheduleRoomCleanup(documentId);
    });

    ws.on('error', (err) => console.error(`[ws] Socket error for doc ${documentId}:`, err.message));
  });

  return wss;
}
