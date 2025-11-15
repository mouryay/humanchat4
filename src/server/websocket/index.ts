import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'url';
import { redis } from '../db/redis.js';

const sessionChannels = new Map<string, Set<WebSocket>>();
const statusClients = new Set<WebSocket>();
const notificationChannels = new Map<string, Set<WebSocket>>();

const addToChannel = (collection: Map<string, Set<WebSocket>>, key: string, socket: WebSocket): void => {
  const existing = collection.get(key) ?? new Set<WebSocket>();
  existing.add(socket);
  collection.set(key, existing);
};

const removeSocket = (set?: Set<WebSocket>, socket?: WebSocket): void => {
  if (set && socket) {
    set.delete(socket);
  }
};

const broadcast = (set: Set<WebSocket> | undefined, data: unknown): void => {
  if (!set) return;
  const payload = JSON.stringify(data);
  set.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

export const setupWebSockets = (server: Server): void => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket, req) => {
    const { pathname } = parse(req.url ?? '/');
    if (!pathname) {
      socket.close(1008, 'Invalid path');
      return;
    }

    if (pathname.startsWith('/session/')) {
      const sessionId = pathname.split('/')[2];
      addToChannel(sessionChannels, sessionId, socket);
      socket.on('message', (message) => {
        broadcast(sessionChannels.get(sessionId), { type: 'signal', payload: message.toString() });
      });
      socket.on('close', () => removeSocket(sessionChannels.get(sessionId), socket));
      return;
    }

    if (pathname === '/status') {
      statusClients.add(socket);
      socket.on('close', () => statusClients.delete(socket));
      return;
    }

    if (pathname.startsWith('/notifications/')) {
      const userId = pathname.split('/')[2];
      addToChannel(notificationChannels, userId, socket);
      socket.on('close', () => removeSocket(notificationChannels.get(userId), socket));
      return;
    }

    socket.close(1008, 'Unknown channel');
  });

  const subscriber = redis.duplicate();
  subscriber.subscribe('status', 'session', 'notification');
  subscriber.on('message', (channel, message) => {
    const payload = JSON.parse(message);
    switch (channel) {
      case 'status':
        broadcast(statusClients, payload);
        break;
      case 'session':
        broadcast(sessionChannels.get(payload.sessionId), payload);
        break;
      case 'notification':
        broadcast(notificationChannels.get(payload.userId), payload);
        break;
      default:
        break;
    }
  });
};
