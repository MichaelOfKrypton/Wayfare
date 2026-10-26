/**
 * Database CLI: `migrate`, `seed`, `reset`.
 * Usage: tsx src/db/cli.ts <command>   (or the root `npm run db:*` scripts)
 * Set DATABASE_URL to target another database (tests use TEST_DATABASE_URL).
 */
import { todayInTimeZone } from '@wayfare/shared';
import { seed } from '../../seed/seed';
import { loadConfig } from '../config';
import { migrate, resetSchema } from './migrate';
import { createPool } from './pool';

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command || !['migrate', 'seed', 'reset'].includes(command)) {
    console.error('Usage: cli.ts <migrate|seed|reset>');
    process.exitCode = 2;
    return;
  }

  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  const log = (msg: string) => console.info(`[db] ${msg}`);
  const referenceDate = config.SEED_REFERENCE_DATE ?? todayInTimeZone();

  try {
    if (command === 'reset') {
      if (config.NODE_ENV === 'production')
        throw new Error('Refusing to reset a production database.');
      log(`resetting schema on ${redact(config.DATABASE_URL)}`);
      await resetSchema(pool);
    }
    if (command === 'migrate' || command === 'reset') {
      const { applied } = await migrate(pool, log);
      log(applied.length ? `${applied.length} migration(s) applied` : 'schema up to date');
    }
    if (command === 'seed' || command === 'reset') {
      const summary = await seed(pool, referenceDate, { dataset: config.SEED_DATASET });
      log(
        `seeded ${summary.source === 'osm' ? 'real OpenStreetMap places' : 'synthetic'} dataset (reference date ${summary.referenceDate})`,
      );
      for (const [table, n] of Object.entries(summary.counts)) log(`  ${table.padEnd(26)} ${n}`);
    }
  } catch (error) {
    if (isConnectionError(error)) {
      console.error(
        `[db] Could not connect to ${redact(config.DATABASE_URL)}. Is the database running? Try: npm run db:up`,
      );
    } else {
      console.error(`[db] ${(error as Error).message}`);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function redact(url: string): string {
  return url.replace(/\/\/([^:/]+):[^@]+@/, '//$1:****@');
}

function isConnectionError(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT';
}

void main();
