import { z } from 'zod';
import { isValidDateString } from '@wayfare/shared';
import { loadRootEnv } from './lib/env';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url({ error: 'DATABASE_URL must be a postgres:// URL' }),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SEED_REFERENCE_DATE: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || isValidDateString(v), {
      error: 'SEED_REFERENCE_DATE must be YYYY-MM-DD',
    }),
});

export type AppConfig = z.output<typeof envSchema>;

export function loadConfig(overrides: Partial<Record<keyof AppConfig, string>> = {}): AppConfig {
  loadRootEnv();
  const result = envSchema.safeParse({ ...process.env, ...overrides });
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration. Check your .env file (see .env.example):\n${details}`);
  }
  return result.data;
}
