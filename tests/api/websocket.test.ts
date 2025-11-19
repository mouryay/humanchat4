/// <reference types="jest" />
import http from 'http';
import WebSocket from 'ws';
import { AddressInfo } from 'net';
import { setupWebSockets } from '../../src/server/websocket/index';

type SubscriberMock = {
  subscribe: jest.Mock;
  on: jest.Mock;
  messageHandler: ((channel: string, message: string) => void) | undefined;
};

const publishMock = jest.fn();
const subscriber: SubscriberMock = {
  subscribe: jest.fn(),
  on: jest.fn((event: string, handler: (channel: string, message: string) => void) => {
    if (event === 'message') {
      subscriber.messageHandler = handler;
    }
  }),
  messageHandler: undefined
};

jest.mock('../../src/server/db/redis', () => ({
  redis: {
    duplicate: () => subscriber,
    publish: (...args: unknown[]) => publishMock(...(args as [string, string]))
  }
}));

describe('setupWebSockets', () => {
  let server: http.Server;
  let baseUrl: string;
  let closeSockets: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    server = http.createServer();
    ({ close: closeSockets } = setupWebSockets(server));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `ws://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (closeSockets) {
      await closeSockets();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('relays session signaling messages between peers', async () => {
    const clientA = await openSocket(`${baseUrl}/session/test-session?userId=alpha`);
    const clientB = await openSocket(`${baseUrl}/session/test-session?userId=beta`);

    await waitForMessage(clientA); // session-ready envelope
    await waitForMessage(clientB);

    const payload = { type: 'offer', sdp: 'fake' };
    clientA.send(JSON.stringify(payload));

    const relay = await waitForMessage(clientB);
    expect(relay.type).toBe('offer');
    expect(relay.senderId).toBe('alpha');

    clientA.close();
    clientB.close();
  });

  it('broadcasts status payloads from redis subscriber', async () => {
    const statusClient = await openSocket(`${baseUrl}/status`);

    subscriber.messageHandler?.('status', JSON.stringify({ userId: 'mentor-1', isOnline: true }));

    const update = await waitForMessage(statusClient);
    expect(update.userId).toBe('mentor-1');
    expect(update.isOnline).toBe(true);

    statusClient.close();
  });
});

type BufferedWebSocket = WebSocket & {
  __messageQueue?: string[];
  __messageResolvers?: Array<(message: string) => void>;
};

const openSocket = (url: string) => {
  return new Promise<BufferedWebSocket>((resolve, reject) => {
    const ws = new WebSocket(url) as BufferedWebSocket;
    ws.__messageQueue = [];
    ws.__messageResolvers = [];

    ws.on('message', (data) => {
      const payload = data.toString();
      const resolver = ws.__messageResolvers?.shift();
      if (resolver) {
        resolver(payload);
      } else {
        ws.__messageQueue?.push(payload);
      }
    });

    ws.once('open', () => resolve(ws));
    ws.once('error', (error) => reject(error));
  });
};

const waitForMessage = (ws: BufferedWebSocket) => {
  const queued = ws.__messageQueue?.shift();
  if (queued) {
    return Promise.resolve(JSON.parse(queued));
  }

  return new Promise<any>((resolve, reject) => {
    ws.__messageResolvers?.push((message) => {
      try {
        resolve(JSON.parse(message));
      } catch (error) {
        reject(error);
      }
    });
    ws.once('error', (error) => reject(error));
  });
};
