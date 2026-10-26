import {
  DATA_NOTICE,
  diffDays,
  validateStayDates,
  type SearchQuery,
  type SearchReference,
  type SearchResponse,
} from '@wayfare/shared';
import type { AppDeps } from '../../app';
import { ValidationError, type Issue } from '../../lib/errors';
import { findDestinationBySlug } from '../destinations/destinations.repository';
import { searchProperties, type SearchCriteria } from './search.repository';

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_COORDINATE_RADIUS_KM = 25;

export async function runSearch(deps: AppDeps, query: SearchQuery): Promise<SearchResponse> {
  const issues: Issue[] = validateStayDates(query.checkIn, query.checkOut, deps.clock.today());
  if (issues.length) throw new ValidationError(issues);

  const reference = await resolveReference(deps, query);
  await assertKnownSlugs(deps, query, issues);
  if (issues.length) throw new ValidationError(issues);

  const nights = diffDays(query.checkIn, query.checkOut);
  const criteria: SearchCriteria = {
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    nights,
    guests: query.guests,
    reference,
    q: query.q,
    minBedrooms: query.minBedrooms,
    minPriceCents: query.minPrice !== undefined ? query.minPrice * 100 : undefined,
    maxPriceCents: query.maxPrice !== undefined ? query.maxPrice * 100 : undefined,
    typeSlugs: query.types ?? [],
    amenitySlugs: query.amenities ?? [],
    minRating: query.minRating,
    freeCancellation: query.freeCancellation ?? false,
    sort: query.sort ?? 'recommended',
  };

  const pageNumber = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const result = await searchProperties(deps.pool, criteria, {
    limit: pageSize,
    offset: (pageNumber - 1) * pageSize,
  });

  return {
    items: result.items,
    pagination: {
      page: pageNumber,
      pageSize,
      totalItems: result.totalItems,
      totalPages: Math.ceil(result.totalItems / pageSize),
    },
    mapPoints: result.mapPoints,
    mapPointsTruncated: result.mapPointsTruncated,
    reference: reference ? toReferenceSummary(reference) : null,
    stay: { checkIn: query.checkIn, checkOut: query.checkOut, nights, guests: query.guests },
    dataNotice: DATA_NOTICE,
  };
}

type ResolvedReference = NonNullable<SearchCriteria['reference']> & {
  label: string;
  kind: SearchReference['kind'];
};

async function resolveReference(
  deps: AppDeps,
  query: SearchQuery,
): Promise<ResolvedReference | null> {
  if (query.destination) {
    const destination = await findDestinationBySlug(deps.pool, query.destination);
    if (!destination) {
      throw new ValidationError([
        {
          path: 'destination',
          message: `We couldn't find a destination called "${query.destination}".`,
        },
      ]);
    }
    return {
      kind: 'destination',
      label: destination.name,
      lat: destination.lat,
      lng: destination.lng,
      radiusKm: query.radiusKm ?? destination.searchRadiusKm,
    };
  }
  if (query.lat !== undefined && query.lng !== undefined) {
    return {
      kind: 'coordinates',
      label: 'Your location',
      lat: query.lat,
      lng: query.lng,
      radiusKm: query.radiusKm ?? DEFAULT_COORDINATE_RADIUS_KM,
    };
  }
  return null;
}

function toReferenceSummary(ref: ResolvedReference): SearchReference {
  return { kind: ref.kind, label: ref.label, lat: ref.lat, lng: ref.lng, radiusKm: ref.radiusKm };
}

/** Unknown filter values are errors, not silently ignored (a typo must not look like "no results"). */
async function assertKnownSlugs(deps: AppDeps, query: SearchQuery, issues: Issue[]): Promise<void> {
  const checks: [keyof SearchQuery & ('types' | 'amenities'), string, string[] | undefined][] = [
    ['types', 'property_types', query.types],
    ['amenities', 'amenities', query.amenities],
  ];
  for (const [path, table, values] of checks) {
    if (!values?.length) continue;
    const { rows } = await deps.pool.query<{ slug: string }>(
      `SELECT slug FROM ${table} WHERE slug = ANY($1::text[])`,
      [values],
    );
    const known = new Set(rows.map((r) => r.slug));
    const unknown = values.filter((v) => !known.has(v));
    if (unknown.length)
      issues.push({ path, message: `${path}: unknown value(s): ${unknown.join(', ')}.` });
  }
}
