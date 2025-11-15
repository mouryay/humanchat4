import Redis from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.redisUrl);

redis.on('error', (error) => {
  console.error('[Redis] connection error', error);
});
