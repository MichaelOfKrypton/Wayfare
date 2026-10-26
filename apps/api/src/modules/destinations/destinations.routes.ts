import {
  destinationsQuerySchema,
  slugParamSchema,
  type DestinationsResponse,
} from '@wayfare/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../../app';
import { NotFoundError } from '../../lib/errors';
import { parseOrThrow } from '../../lib/validation';
import { findDestinationBySlug, searchDestinations } from './destinations.repository';

export const destinationRoutes: FastifyPluginAsync<{ deps: AppDeps }> = async (app, { deps }) => {
  app.get('/destinations', async (request): Promise<DestinationsResponse> => {
    const query = parseOrThrow(destinationsQuerySchema, request.query);
    const items = await searchDestinations(deps.pool, {
      q: query.q,
      featured: query.featured,
      limit: query.limit ?? 8,
    });
    return { items };
  });

  app.get('/destinations/:slug', async (request) => {
    const { slug } = parseOrThrow(slugParamSchema, request.params);
    const destination = await findDestinationBySlug(deps.pool, slug);
    if (!destination) throw new NotFoundError(`No destination called "${slug}".`);
    return destination;
  });
};
