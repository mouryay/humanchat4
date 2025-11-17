import '@testing-library/jest-dom';
import matchers from '@testing-library/jest-dom/matchers';
import { expect } from '@jest/globals';
import 'whatwg-fetch';
import type { BootstrapPayload } from './src/lib/db';
import { server } from './tests/msw/server';

expect.extend(matchers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
  if (typeof window !== 'undefined') {
    const fallbackSeed: BootstrapPayload = {
      conversations: [
        {
          conversationId: 'sam-concierge',
          type: 'sam',
          participants: ['sam', 'demo-user'],
          lastActivity: Date.now(),
          unreadCount: 0
        }
      ],
      messages: [
        {
          id: 1,
          conversationId: 'sam-concierge',
          senderId: 'sam',
          content: 'Hello from Sam test bootstrap!',
          timestamp: Date.now() - 1000,
          type: 'sam_response'
        }
      ]
    };
    window.__HUMANCHAT_BOOTSTRAP__ = window.__HUMANCHAT_BOOTSTRAP__ ?? fallbackSeed;
  }
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    // @ts-expect-error adding test-only stub
    window.ResizeObserver = ResizeObserver;
  }

  if (!('Notification' in window)) {
    // @ts-expect-error test-only Notification shim
    window.Notification = class {
      static permission = 'granted';
      static async requestPermission() {
        return 'granted';
      }
      constructor(public title: string, public options?: NotificationOptions) {
        this.title = title;
        this.options = options;
      }
    } as typeof Notification;
  } else {
    Object.defineProperty(Notification, 'permission', {
      configurable: true,
      get: () => 'granted'
    });
  }

  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
      })
    });
  }

  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => undefined;
  }
}

if (!HTMLMediaElement.prototype.play) {
  HTMLMediaElement.prototype.play = async () => undefined;
}
if (!HTMLMediaElement.prototype.pause) {
  HTMLMediaElement.prototype.pause = () => undefined;
}

