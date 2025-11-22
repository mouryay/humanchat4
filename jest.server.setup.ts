process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

let redisClosed = false;

afterAll(async () => {
	if (redisClosed) {
		return;
	}

	const hasRedisInstance = Boolean((globalThis as { __humanchatRedis__?: unknown }).__humanchatRedis__);
	if (!hasRedisInstance) {
		return;
	}

	redisClosed = true;
	const { shutdownRedis } = await import('./src/server/db/redis.js');
	await shutdownRedis();
});
