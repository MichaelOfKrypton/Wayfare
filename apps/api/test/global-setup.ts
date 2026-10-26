/**
 * Prepares the integration-test database once per run: drop schema → migrate →
 * seed with today's date (SAST) as the reference, exactly like `npm run db:reset`.
 */
import { todayInTimeZone } from '@wayfare/shared';
import type { TestProject } from 'vitest/node';
import { seed } from '../seed/seed';
import { migrate, resetSchema } from '../src/db/migrate';
import { createPool } from '../src/db/pool';
import { loadRootEnv } from '../src/lib/env';

declare module 'vitest' {
  export interface ProvidedContext {
    referenceDate: string;
    testDatabaseUrl: string;
  }
}

export default async function setup(project: TestProject): Promise<void> {
  loadRootEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example).');
  if (!/_test\b/.test(new URL(url).pathname)) {
    throw new Error(
      `Refusing to reset a database whose name does not end in "_test": ${new URL(url).pathname}`,
    );
  }

  const referenceDate = todayInTimeZone();
  const pool = createPool(url);
  try {
    await resetSchema(pool);
    await migrate(pool);
    await seed(pool, referenceDate);
  } catch (error) {
    throw new Error(
      `Could not prepare the test database. Is it running (npm run db:up)? ${(error as Error).message}`,
      { cause: error },
    );
  } finally {
    await pool.end();
  }
  project.provide('referenceDate', referenceDate);
  project.provide('testDatabaseUrl', url);
}
