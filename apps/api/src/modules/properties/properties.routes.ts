import {
  diffDays,
  offersQuerySchema,
  slugParamSchema,
  validateStayDates,
  type OffersResponse,
  type PropertyDetail,
} from '@wayfare/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../../app';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { parseOrThrow } from '../../lib/validation';
import { buildOffersResponse } from './offers.service';
import {
  findOffersForStay,
  findPropertyBySlug,
  findPropertyIdBySlug,
} from './properties.repository';

export const propertyRoutes: FastifyPluginAsync<{ deps: AppDeps }> = async (app, { deps }) => {
  app.get('/properties/:slug', async (request): Promise<PropertyDetail> => {
    const { slug } = parseOrThrow(slugParamSchema, request.params);
    const property = await findPropertyBySlug(deps.pool, slug);
    if (!property) throw new NotFoundError(`No property called "${slug}".`);
    return property;
  });

  app.get('/properties/:slug/offers', async (request): Promise<OffersResponse> => {
    const { slug } = parseOrThrow(slugParamSchema, request.params);
    const query = parseOrThrow(offersQuerySchema, request.query);
    const dateIssues = validateStayDates(query.checkIn, query.checkOut, deps.clock.today());
    if (dateIssues.length) throw new ValidationError(dateIssues);

    const propertyId = await findPropertyIdBySlug(deps.pool, slug);
    if (propertyId === null) throw new NotFoundError(`No property called "${slug}".`);

    const nights = diffDays(query.checkIn, query.checkOut);
    const stay = { checkIn: query.checkIn, checkOut: query.checkOut, guests: query.guests, nights };
    const rows = await findOffersForStay(deps.pool, propertyId, stay);
    return buildOffersResponse(rows, stay);
  });
};
