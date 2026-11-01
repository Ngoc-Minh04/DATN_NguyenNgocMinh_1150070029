import Redis from 'ioredis';
import { ENV } from './env.js';

export const redisClient = new Redis({
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  password: ENV.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      return null; // Stop retrying after 3 attempts
    }
    return Math.min(times * 1000, 3000);
  },
});

redisClient.on('connect', () => {
  console.log('[Redis Connected] Successfully connected to Redis instance.');
});

redisClient.on('error', (err) => {
  console.warn(`[Redis Connection Warning] ${err.message}`);
});

export async function testRedisConnection(): Promise<boolean> {
  try {
    await redisClient.connect();
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch (err: any) {
    console.warn(`[Redis Connect Fallback] Continuing without active Redis cache: ${err.message}`);
    return false;
  }
}
