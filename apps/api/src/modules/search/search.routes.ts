import { searchQuerySchema, type SearchResponse } from '@wayfare/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../../app';
import { parseOrThrow } from '../../lib/validation';
import { runSearch } from './search.service';

export const searchRoutes: FastifyPluginAsync<{ deps: AppDeps }> = async (app, { deps }) => {
  app.get('/search', async (request): Promise<SearchResponse> => {
    const query = parseOrThrow(searchQuerySchema, request.query);
    return runSearch(deps, query);
  });
};
