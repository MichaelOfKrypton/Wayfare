import { destinationsQuerySchema, slugParamSchema } from '@wayfare/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../../app';
import { respondCached } from '../../lib/cached-response';
import { NotFoundError } from '../../lib/errors';
import { parseOrThrow } from '../../lib/validation';
import { findDestinationBySlug, searchDestinations } from './destinations.repository';

export const destinationRoutes: FastifyPluginAsync<{ deps: AppDeps }> = async (app, { deps }) => {
  app.get('/destinations', async (request, reply) =>
    respondCached(deps.cache, request, reply, request.url, async () => {
      const query = parseOrThrow(destinationsQuerySchema, request.query);
      const items = await searchDestinations(deps.pool, {
        q: query.q,
        featured: query.featured,
        limit: query.limit ?? 8,
      });
      return { items };
    }),
  );

  app.get('/destinations/:slug', async (request, reply) => {
    const { slug } = parseOrThrow(slugParamSchema, request.params);
    return respondCached(
      deps.cache,
      request,
      reply,
      `destination|${slug}`,
      () => findDestinationBySlug(deps.pool, slug),
      () => new NotFoundError(`No destination called "${slug}".`),
    );
  });
};
