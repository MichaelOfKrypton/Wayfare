import { buildApp } from './app';
import { loadConfig } from './config';
import { createPool } from './db/pool';

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  const app = await buildApp({ config, pool });

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
