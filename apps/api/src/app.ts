import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { ApiErrorBody } from '@wayfare/shared';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { AppConfig } from './config';
import type { Pool } from './db/pool';
import { systemClock, type Clock } from './lib/clock';
import { AppError, ServiceUnavailableError } from './lib/errors';
import { destinationRoutes } from './modules/destinations/destinations.routes';
import { filterRoutes } from './modules/filters/filters.routes';
import { healthRoutes } from './modules/health/health.routes';
import { propertyRoutes } from './modules/properties/properties.routes';
import { searchRoutes } from './modules/search/search.routes';

export interface AppDeps {
  pool: Pool;
  clock: Clock;
}

export interface BuildAppOptions {
  config: Pick<AppConfig, 'NODE_ENV' | 'LOG_LEVEL' | 'CORS_ORIGIN'>;
  pool: Pool;
  clock?: Clock;
  /** Requests per minute per IP; 0 disables rate limiting (used by tests). */
  rateLimitPerMinute?: number;
}

const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  '57P01',
  '57P03',
  '53300',
]);

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config, pool } = options;
  const deps: AppDeps = { pool, clock: options.clock ?? systemClock };

  const logger: FastifyServerOptions['logger'] =
    config.NODE_ENV === 'test'
      ? false
      : {
          level: config.LOG_LEVEL,
          // Never log query strings with potential personal data beyond the path + params we use.
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        };

  const app = Fastify({
    logger,
    // Keep request bodies tiny: the API is read-only.
    bodyLimit: 16 * 1024,
    routerOptions: { ignoreTrailingSlash: true, maxParamLength: 120 },
  });

  await app.register(helmet, {
    // JSON API: a strict CSP is harmless and blocks any accidental HTML rendering.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  });
  await app.register(cors, { origin: config.CORS_ORIGIN, methods: ['GET'] });
  if ((options.rateLimitPerMinute ?? 300) > 0) {
    await app.register(rateLimit, {
      max: options.rateLimitPerMinute ?? 300,
      timeWindow: '1 minute',
      errorResponseBuilder: (_req, context) => ({
        statusCode: 429,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Please wait ${Math.ceil(context.ttl / 1000)} seconds and try again.`,
        },
      }),
    });
  }

  app.setErrorHandler((rawError, request, reply) => {
    const requestId = request.id;
    const error = rawError as Error & { statusCode?: number; code?: string };
    if (error instanceof AppError) {
      const body: ApiErrorBody = {
        error: { code: error.code, message: error.message, issues: error.issues, requestId },
      };
      return reply.status(error.statusCode).send(body);
    }
    const statusCode = error.statusCode;
    if (statusCode === 429) {
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Too many requests.', requestId },
      } satisfies ApiErrorBody);
    }
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      // Framework-level client errors (e.g. malformed URL). Their messages are generic and safe.
      return reply.status(statusCode).send({
        error: { code: 'VALIDATION_ERROR', message: error.message, requestId },
      } satisfies ApiErrorBody);
    }
    const code = error.code;
    if (code && DB_UNAVAILABLE_CODES.has(code)) {
      request.log.error({ err: error }, 'database unavailable');
      const unavailable = new ServiceUnavailableError();
      return reply.status(503).send({
        error: { code: unavailable.code, message: unavailable.message, requestId },
      } satisfies ApiErrorBody);
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong on our side. Please try again.',
        requestId,
      },
    } satisfies ApiErrorBody);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `No route for ${request.method} ${request.url.split('?')[0]}.`,
        requestId: request.id,
      },
    } satisfies ApiErrorBody);
  });

  await app.register(
    async (api) => {
      await api.register(healthRoutes, { deps });
      await api.register(destinationRoutes, { deps });
      await api.register(filterRoutes, { deps });
      await api.register(searchRoutes, { deps });
      await api.register(propertyRoutes, { deps });
    },
    { prefix: '/api' },
  );

  return app;
}
