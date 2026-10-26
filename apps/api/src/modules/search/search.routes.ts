import { searchQuerySchema } from '@wayfare/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../../app';
import { respondCached } from '../../lib/cached-response';
import { parseOrThrow } from '../../lib/validation';
import { runSearch } from './search.service';

export const searchRoutes: FastifyPluginAsync<{ deps: AppDeps }> = async (app, { deps }) => {
  app.get('/search', async (request, reply) =>
    // "Today" is part of the key: date validation and the "tonight" filter depend on it.
    // Validation runs inside, so a cache hit skips it (invalid requests are never cached).
    respondCached(deps.cache, request, reply, `${request.url}|${deps.clock.today()}`, () =>
      runSearch(deps, parseOrThrow(searchQuerySchema, request.query)),
    ),
  );
};
