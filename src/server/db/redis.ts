import Redis from 'ioredis';
import { env } from '../config/env.js';

declare global {
  // eslint-disable-next-line no-var
  var __humanchatRedis__: Redis | undefined;
}

const globalRedis = globalThis as typeof globalThis & { __humanchatRedis__?: Redis };

const sharedRedis = globalRedis.__humanchatRedis__ ?? new Redis(env.redisUrl);
if (!globalRedis.__humanchatRedis__) {
  globalRedis.__humanchatRedis__ = sharedRedis;
}

export const redis = sharedRedis;

redis.on('error', (error) => {
  console.error('[Redis] connection error', error);
});

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
