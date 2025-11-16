"use client";

import { useEffect } from 'react';
import { initializeNotifications } from '../utils/notifications';

const SERVICE_WORKER_PATH = '/sw.js';

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: {
    register: (tag: string) => Promise<unknown>;
  };
};

export default function PWAInitializer() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = async () => {
      try {
        const registration = (await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' })) as SyncCapableRegistration;
        if (registration.sync) {
          await registration.sync.register('sync-messages').catch(() => undefined);
        }
      } catch (error) {
        console.warn('Service worker registration failed', error);
      }
    };
    register();
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_MESSAGES') {
        window.dispatchEvent(new CustomEvent('humanchat-sync'));
      }
    };
    navigator.serviceWorker.addEventListener('message', messageHandler);
    return () => {
      navigator.serviceWorker.removeEventListener('message', messageHandler);
    };
  }, []);

  useEffect(() => {
    void initializeNotifications();
  }, []);

  return null;
}
