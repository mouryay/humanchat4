import { Redis } from 'ioredis';
import { env } from '../config/env.js';

class NoopRedis {
  status: Redis['status'] = 'end';

  publish(): Promise<number> {
    return Promise.resolve(0);
  }

  subscribe(): Promise<number> {
    return Promise.resolve(0);
  }

  duplicate(): this {
    return this;
  }

  on(): this {
    return this;
  }

  get(): Promise<string | null> {
    return Promise.resolve(null);
  }

  set(): Promise<'OK'> {
    return Promise.resolve('OK');
  }

  lpush(): Promise<number> {
    return Promise.resolve(0);
  }

  ltrim(): Promise<'OK'> {
    return Promise.resolve('OK');
  }

  lrange(): Promise<string[]> {
    return Promise.resolve([]);
  }

  quit(): Promise<'OK'> {
    return Promise.resolve('OK');
  }

  disconnect(): void {
    // noop
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __humanchatRedis__: Redis | undefined;
}

const globalRedis = globalThis as typeof globalThis & { __humanchatRedis__?: Redis };

const createRedisClient = (): Redis => {
  if (!env.redisUrl) {
    console.warn('[Redis] REDIS_URL missing; disabling Redis features until Memorystore is configured.');
    return new NoopRedis() as unknown as Redis;
  }

  const client = new Redis(env.redisUrl);
  client.on('error', (error: Error) => {
    console.error('[Redis] connection error', error);
  });
  return client;
};

const sharedRedis: Redis = globalRedis.__humanchatRedis__ ?? createRedisClient();
if (!globalRedis.__humanchatRedis__) {
  globalRedis.__humanchatRedis__ = sharedRedis;
}

export const redis: Redis = sharedRedis;

export const shutdownRedis = async (): Promise<void> => {
  if (!redis || redis.status === 'end') {
    return;
  }

  try {
    await redis.quit();
  } catch (error) {
    redis.disconnect(false);
  } finally {
    globalRedis.__humanchatRedis__ = undefined;
  }
};
