import {
  calendarQuerySchema,
  diffDays,
  offersQuerySchema,
  slugParamSchema,
  validateStayDates,
} from '@wayfare/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../../app';
import { respondCached } from '../../lib/cached-response';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { parseOrThrow } from '../../lib/validation';
import { buildCalendar, priceableRange } from './calendar.service';
import { buildOffersResponse } from './offers.service';
import {
  findCalendar,
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

  app.get('/properties/:slug/calendar', async (request, reply) => {
    const { slug } = parseOrThrow(slugParamSchema, request.params);
    const today = deps.clock.today();
    return respondCached(
      deps.cache,
      request,
      reply,
      `${request.url}|${today}`,
      async () => {
        const query = parseOrThrow(calendarQuerySchema, request.query);
        const range = priceableRange(query.month, today);
        const propertyId = await findPropertyIdBySlug(deps.pool, slug);
        if (propertyId === null) return null;
        const rows = await findCalendar(deps.pool, propertyId, {
          from: range.from,
          to: range.to,
          nights: query.nights,
          guests: query.guests,
        });
        return buildCalendar(query, range, rows);
      },
      () => new NotFoundError(`No property called "${slug}".`),
    );
  });
};
