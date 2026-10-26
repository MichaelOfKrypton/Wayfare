import { addDays } from '@wayfare/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, inject } from 'vitest';
import { buildApp } from '../src/app';
import { createPool, type Pool } from '../src/db/pool';

export interface TestContext {
  app: FastifyInstance;
  pool: Pool;
  today: string;
  /** Builds a stay starting `offset` days from today. */
  stay: (offset: number, nights: number, guests?: number) => Record<string, string>;
}

/** Registers hooks that build one app + pool per test file and tear them down afterwards. */
export function useTestApp(): TestContext {
  const ctx = {} as TestContext;
  beforeAll(async () => {
    ctx.pool = createPool(inject('testDatabaseUrl'));
    ctx.app = await buildApp({
      config: { NODE_ENV: 'test', LOG_LEVEL: 'silent', CORS_ORIGIN: 'http://localhost:5173' },
      pool: ctx.pool,
      rateLimitPerMinute: 0,
    });
    ctx.today = inject('referenceDate');
    ctx.stay = (offset, nights, guests = 2) => ({
      checkIn: addDays(ctx.today, offset),
      checkOut: addDays(ctx.today, offset + nights),
      guests: String(guests),
    });
  });
  afterAll(async () => {
    await ctx.app?.close();
    await ctx.pool?.end();
  });
  return ctx;
}

export async function getJson<T = unknown>(
  app: FastifyInstance,
  path: string,
  query: Record<string, string> = {},
): Promise<{ status: number; body: T }> {
  const qs = new URLSearchParams(query).toString();
  const response = await app.inject({ method: 'GET', url: qs ? `${path}?${qs}` : path });
  return { status: response.statusCode, body: response.json() as T };
}
