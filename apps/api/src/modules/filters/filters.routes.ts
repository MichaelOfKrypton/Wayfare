import { SORT_OPTIONS, type FiltersResponse } from '@wayfare/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../../app';
import { parseOrThrow } from '../../lib/validation';

export const filterRoutes: FastifyPluginAsync<{ deps: AppDeps }> = async (app, { deps }) => {
  app.get('/filters', async (request): Promise<FiltersResponse> => {
    parseOrThrow(z.strictObject({}), request.query);
    const [types, amenities, bounds] = await Promise.all([
      deps.pool.query<FiltersResponse['propertyTypes'][number]>(`
        SELECT pt.slug, pt.name, count(p.id)::int AS "propertyCount"
        FROM property_types pt LEFT JOIN properties p ON p.property_type_id = pt.id
        GROUP BY pt.id ORDER BY pt.sort_order`),
      deps.pool.query<FiltersResponse['amenities'][number]>(`
        SELECT slug, name, category, is_essential AS "isEssential"
        FROM amenities ORDER BY sort_order`),
      // Bounds of the one-night, VAT-inclusive price across active offers — a sensible slider range.
      deps.pool.query<{ min: number | null; max: number | null }>(`
        SELECT min(q.total_cents) AS min, max(q.total_cents) AS max
        FROM offers o
        CROSS JOIN LATERAL quote_stay(o.nightly_rate_cents, NULL, o.fee_per_stay_cents, o.tax_rate_bps,
                                      o.prices_include_tax, DATE '2000-01-03', DATE '2000-01-04') q
        WHERE o.status = 'active'`),
    ]);
    return {
      propertyTypes: types.rows,
      amenities: amenities.rows,
      priceBounds: {
        minNightlyCents: bounds.rows[0]?.min ?? 0,
        maxNightlyCents: bounds.rows[0]?.max ?? 0,
        currency: 'ZAR',
      },
      sortOptions: [...SORT_OPTIONS],
    };
  });
};
