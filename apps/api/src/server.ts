import cluster from 'node:cluster';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createPool } from './db/pool';

/**
 * Starts the API. With API_WORKERS > 1 the primary process forks that many
 * workers that share the port (Node's cluster module), so the API uses several
 * CPU cores. Each worker has its own connection pool and response cache.
 */
async function main(): Promise<void> {
  const config = loadConfig();

  if (config.API_WORKERS > 1 && cluster.isPrimary) {
    console.info(`[api] starting ${config.API_WORKERS} workers`);
    for (let i = 0; i < config.API_WORKERS; i += 1) cluster.fork();
    let stopping = false;
    cluster.on('exit', (worker, code) => {
      if (stopping) return;
      console.error(`[api] worker ${worker.process.pid} exited (${code}); starting a new one`);
      cluster.fork();
    });
    const stop = () => {
      stopping = true;
      for (const worker of Object.values(cluster.workers ?? {})) worker?.kill('SIGTERM');
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    return;
  }

  const pool = createPool(config.DATABASE_URL, config.DB_POOL_MAX);
  const app = await buildApp({
    config,
    pool,
    rateLimitPerMinute: config.RATE_LIMIT_PER_MINUTE,
    cacheTtlMs: config.API_CACHE_TTL_MS,
  });

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await pool.query('SELECT 1');
  } catch {
    app.log.warn(
      'Database is not reachable yet. Start it with `npm run db:up`; requests will return 503 until then.',
    );
  }

  await app.listen({ host: config.API_HOST, port: config.API_PORT });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
