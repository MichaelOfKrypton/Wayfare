import { diffDays, offersQuerySchema, slugParamSchema, validateStayDates } from '@wayfare/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../../app';
import { respondCached } from '../../lib/cached-response';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { parseOrThrow } from '../../lib/validation';
import { buildOffersResponse } from './offers.service';
import {
  findOffersForStay,
  findPropertyBySlug,
  findPropertyIdBySlug,
} from './properties.repository';

export const propertyRoutes: FastifyPluginAsync<{ deps: AppDeps }> = async (app, { deps }) => {
  app.get('/properties/:slug', async (request, reply) => {
    const { slug } = parseOrThrow(slugParamSchema, request.params);
    return respondCached(
      deps.cache,
      request,
      reply,
      `property|${slug}`,
      () => findPropertyBySlug(deps.pool, slug),
      () => new NotFoundError(`No property called "${slug}".`),
    );
  });

  app.get('/properties/:slug/offers', async (request, reply) => {
    const { slug } = parseOrThrow(slugParamSchema, request.params);
    const today = deps.clock.today();
    return respondCached(
      deps.cache,
      request,
      reply,
      `${request.url}|${today}`,
      async () => {
        const query = parseOrThrow(offersQuerySchema, request.query);
        const dateIssues = validateStayDates(query.checkIn, query.checkOut, today);
        if (dateIssues.length) throw new ValidationError(dateIssues);
        const propertyId = await findPropertyIdBySlug(deps.pool, slug);
        if (propertyId === null) return null;
        const nights = diffDays(query.checkIn, query.checkOut);
        const stay = { ...query, nights };
        return buildOffersResponse(await findOffersForStay(deps.pool, propertyId, stay), stay);
      },
      () => new NotFoundError(`No property called "${slug}".`),
    );
  });
};
