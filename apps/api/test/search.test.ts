import {
  haversineKm,
  type ApiErrorBody,
  type SearchResponse,
  type SearchResultItem,
} from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { getJson, useTestApp } from './helpers';

const ctx = useTestApp();

async function search(query: Record<string, string>) {
  return getJson<SearchResponse>(ctx.app, '/api/search', query);
}

/** Fetches every page so tests can reason about the complete result set. */
async function searchAll(query: Record<string, string>): Promise<SearchResultItem[]> {
  const items: SearchResultItem[] = [];
  for (let page = 1; page < 50; page += 1) {
    const { status, body } = await search({ ...query, page: String(page), pageSize: '50' });
    expect(status).toBe(200);
    items.push(...body.items);
    if (page >= body.pagination.totalPages) break;
  }
  return items;
}

/**
 * Independent oracle: which properties have at least one eligible offer?
 * Deliberately written as a plain EXISTS query, unlike the production CTE pipeline.
 */
async function eligiblePropertyIds(
  stay: Record<string, string>,
  extra: { minBedrooms?: number; free?: boolean } = {},
) {
  const { rows } = await ctx.pool.query<{ id: number }>(
    `SELECT p.id FROM properties p
     WHERE EXISTS (
       SELECT 1 FROM offers o JOIN room_types rt ON rt.id = o.room_type_id
       WHERE o.property_id = p.id AND o.status = 'active'
         AND rt.max_guests >= $3 AND rt.bedrooms >= $4
         AND o.min_nights <= ($2::date - $1::date)
         AND ($5::boolean IS FALSE OR o.cancellation_policy = 'free')
         AND NOT EXISTS (SELECT 1 FROM room_availability_blocks b
                         WHERE b.room_type_id = rt.id AND b.blocked && daterange($1::date, $2::date)))
     ORDER BY p.id`,
    [stay.checkIn, stay.checkOut, Number(stay.guests), extra.minBedrooms ?? 0, extra.free ?? false],
  );
  return rows.map((r) => r.id);
}

const ids = (items: SearchResultItem[]) => items.map((i) => i.id).sort((a, b) => a - b);

describe('GET /api/search — results and counts', () => {
  it('returns exactly the properties with an eligible offer (nationwide)', async () => {
    const stay = ctx.stay(0, 1);
    const items = await searchAll(stay);
    expect(items.length).toBeGreaterThan(40);
    expect(ids(items)).toEqual(await eligiblePropertyIds(stay));
  });

  it('respects guest capacity, bedrooms and free cancellation exactly', async () => {
    const stay = ctx.stay(7, 3, 5);
    const items = await searchAll({ ...stay, minBedrooms: '2', freeCancellation: 'true' });
    expect(ids(items)).toEqual(await eligiblePropertyIds(stay, { minBedrooms: 2, free: true }));
    for (const item of items) {
      expect(item.maxGuests).toBeGreaterThanOrEqual(5);
      expect(item.bestOffer.cancellationPolicy).toBe('free');
    }
  });

  it('reports a total that matches the items across all pages, with no duplicates', async () => {
    const stay = ctx.stay(2, 2);
    const first = await search({ ...stay, pageSize: '7' });
    const all = await searchAll(stay);
    expect(first.body.pagination.totalItems).toBe(all.length);
    expect(first.body.pagination.totalPages).toBe(Math.ceil(all.length / 7));
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
  });

  it('returns an empty page (not an error) beyond the last page', async () => {
    const { status, body } = await search({ ...ctx.stay(0, 1), page: '999' });
    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.pagination.totalItems).toBeGreaterThan(0);
  });

  it('returns a well-formed empty result when nothing matches', async () => {
    const { status, body } = await search({ ...ctx.stay(0, 1), maxPrice: '1' });
    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.mapPoints).toEqual([]);
    expect(body.pagination).toMatchObject({ totalItems: 0, totalPages: 0 });
  });

  it('labels the data as synthetic and marks every best offer as simulated', async () => {
    const { body } = await search(ctx.stay(0, 1));
    expect(body.dataNotice).toMatch(/synthetic/i);
    expect(body.items.every((i) => i.bestOffer.dataStatus === 'simulated')).toBe(true);
    expect(
      body.items.filter((i) => i.rating).every((i) => i.rating!.label === 'Synthetic demo score'),
    ).toBe(true);
  });
});

describe('GET /api/search — location', () => {
  it('limits a destination search to its radius and reports distances', async () => {
    const { body } = await search({ ...ctx.stay(0, 2), destination: 'knysna' });
    expect(body.reference).toMatchObject({ kind: 'destination', label: 'Knysna', radiusKm: 15 });
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.distanceKm).not.toBeNull();
      expect(item.distanceKm!).toBeLessThanOrEqual(15);
      // PostGIS (spheroid) vs haversine (sphere) agree to within 0.5%.
      const km = haversineKm(item, body.reference!);
      expect(Math.abs(km - item.distanceKm!)).toBeLessThan(Math.max(0.05, km * 0.005));
    }
  });

  it('supports coordinate searches with a custom radius', async () => {
    const near = await searchAll({
      ...ctx.stay(0, 1),
      lat: '-33.9249',
      lng: '18.4241',
      radiusKm: '3',
    });
    const wide = await searchAll({
      ...ctx.stay(0, 1),
      lat: '-33.9249',
      lng: '18.4241',
      radiusKm: '30',
    });
    expect(near.length).toBeLessThan(wide.length);
    expect(near.every((i) => i.distanceKm! <= 3)).toBe(true);
  });

  it('returns no distances for a nationwide search', async () => {
    const { body } = await search(ctx.stay(0, 1));
    expect(body.reference).toBeNull();
    expect(body.items.every((i) => i.distanceKm === null)).toBe(true);
  });

  it('includes map points for all matches, not just the current page', async () => {
    const { body } = await search({ ...ctx.stay(0, 1), destination: 'cape-town', pageSize: '3' });
    expect(body.items).toHaveLength(3);
    expect(body.mapPoints.length).toBe(body.pagination.totalItems);
    expect(body.mapPointsTruncated).toBe(false);
  });
});

describe('GET /api/search — filters', () => {
  it('filters by property type', async () => {
    const items = await searchAll({ ...ctx.stay(0, 1), types: 'lodge,farm-stay' });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => ['lodge', 'farm-stay'].includes(i.propertyType.slug))).toBe(true);
  });

  it('filters by amenities using "has all of" semantics', async () => {
    const stay = ctx.stay(0, 1);
    const pool = await searchAll({ ...stay, amenities: 'pool' });
    const both = await searchAll({ ...stay, amenities: 'pool,braai' });
    expect(both.length).toBeGreaterThan(0);
    expect(both.length).toBeLessThan(pool.length);
    const { rows } = await ctx.pool.query<{ property_id: number }>(
      `SELECT pa.property_id FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id
       WHERE a.slug IN ('pool', 'braai') GROUP BY 1 HAVING count(*) = 2`,
    );
    const withBoth = new Set(rows.map((r) => r.property_id));
    expect(both.every((i) => withBoth.has(i.id))).toBe(true);
  });

  it('filters by average nightly price (fees and VAT included)', async () => {
    const items = await searchAll({ ...ctx.stay(0, 2), minPrice: '800', maxPrice: '1500' });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.bestOffer.averageNightlyCents).toBeGreaterThanOrEqual(80_000);
      expect(item.bestOffer.averageNightlyCents).toBeLessThanOrEqual(150_000);
      expect(item.bestOffer.averageNightlyCents).toBe(Math.round(item.bestOffer.totalCents / 2));
    }
  });

  it('filters by minimum demo score and excludes unrated properties', async () => {
    const all = await searchAll(ctx.stay(0, 1));
    const rated = await searchAll({ ...ctx.stay(0, 1), minRating: '9' });
    expect(rated.length).toBeGreaterThan(0);
    expect(rated.length).toBeLessThan(all.length);
    expect(rated.every((i) => i.rating !== null && i.rating.score >= 9)).toBe(true);
  });

  it('matches property names case-insensitively and treats wildcards literally', async () => {
    const items = await searchAll({ ...ctx.stay(0, 1), q: 'GUESTHOUSE' });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => /guesthouse/i.test(i.name))).toBe(true);
    // Unescaped, '%' would match every name and 'B_B' would match "B&B".
    const percent = await search({ ...ctx.stay(0, 1), q: '%' });
    expect(percent.body.pagination.totalItems).toBe(0);
    const underscore = await search({ ...ctx.stay(0, 1), q: 'B_B' });
    expect(underscore.body.pagination.totalItems).toBe(0);
    const literal = await searchAll({ ...ctx.stay(0, 1), q: 'B&B' });
    expect(literal.length).toBeGreaterThan(0);
    expect(literal.every((i) => i.name.includes('B&B'))).toBe(true);
  });

  it('combines filters with AND semantics', async () => {
    const stay = ctx.stay(14, 2, 2);
    const combined = await searchAll({
      ...stay,
      destination: 'cape-town',
      types: 'apartment,guesthouse',
      amenities: 'wifi',
      maxPrice: '4000',
    });
    expect(combined.length).toBeGreaterThan(0);
    for (const item of combined) {
      expect(['apartment', 'guesthouse']).toContain(item.propertyType.slug);
      expect(item.distanceKm!).toBeLessThanOrEqual(20);
      expect(item.bestOffer.averageNightlyCents).toBeLessThanOrEqual(400_000);
    }
  });

  it('excludes rooms that are blocked for the selected dates', async () => {
    const { rows } = await ctx.pool.query<{ property_id: number }>(
      `SELECT rt.property_id FROM room_types rt
       GROUP BY rt.property_id
       HAVING bool_and(EXISTS (SELECT 1 FROM room_availability_blocks b
                               WHERE b.room_type_id = rt.id AND b.blocked @> $1::date))`,
      [ctx.today],
    );
    const fullyBookedTonight = new Set(rows.map((r) => r.property_id));
    const items = await searchAll(ctx.stay(0, 1, 1));
    expect(items.some((i) => fullyBookedTonight.has(i.id))).toBe(false);
  });
});

describe('GET /api/search — sorting', () => {
  const sorted = (values: number[], dir: 'asc' | 'desc') =>
    values.every((v, i) => i === 0 || (dir === 'asc' ? values[i - 1]! <= v : values[i - 1]! >= v));

  it('sorts by price ascending and descending', async () => {
    const asc = await searchAll({ ...ctx.stay(0, 1), sort: 'price_asc' });
    const desc = await searchAll({ ...ctx.stay(0, 1), sort: 'price_desc' });
    expect(
      sorted(
        asc.map((i) => i.bestOffer.averageNightlyCents),
        'asc',
      ),
    ).toBe(true);
    expect(
      sorted(
        desc.map((i) => i.bestOffer.averageNightlyCents),
        'desc',
      ),
    ).toBe(true);
  });

  it('sorts by demo score with unrated properties last', async () => {
    const items = await searchAll({ ...ctx.stay(0, 1), sort: 'rating_desc' });
    const firstUnrated = items.findIndex((i) => i.rating === null);
    const rated = firstUnrated === -1 ? items : items.slice(0, firstUnrated);
    expect(
      sorted(
        rated.map((i) => i.rating!.score),
        'desc',
      ),
    ).toBe(true);
    expect(items.slice(rated.length).every((i) => i.rating === null)).toBe(true);
  });

  it('sorts by distance from the destination', async () => {
    const items = await searchAll({
      ...ctx.stay(0, 1),
      destination: 'johannesburg',
      sort: 'distance_asc',
    });
    expect(
      sorted(
        items.map((i) => i.distanceKm!),
        'asc',
      ),
    ).toBe(true);
  });

  it('keeps pagination stable for every sort order', async () => {
    for (const sort of ['recommended', 'price_asc', 'price_desc', 'rating_desc', 'distance_asc']) {
      const query = { ...ctx.stay(3, 1), destination: 'cape-town', sort };
      const full = await searchAll(query);
      const paged: number[] = [];
      for (let page = 1; page <= Math.ceil(full.length / 4); page += 1) {
        const { body } = await search({ ...query, page: String(page), pageSize: '4' });
        paged.push(...body.items.map((i) => i.id));
      }
      expect(paged).toEqual(full.map((i) => i.id));
    }
  });
});

describe('GET /api/search — validation', () => {
  const expectError = async (query: Record<string, string>, path: string) => {
    const { status, body } = await getJson<ApiErrorBody>(ctx.app, '/api/search', query);
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.issues?.map((i) => i.path)).toContain(path);
  };

  it('rejects past check-in dates using SAST "today"', async () => {
    await expectError(ctx.stay(-1, 2), 'checkIn');
  });

  it('rejects missing and malformed parameters', async () => {
    await expectError({ checkIn: ctx.today, guests: '2' }, 'checkOut');
    await expectError({ ...ctx.stay(0, 1), guests: '17' }, 'guests');
    await expectError({ ...ctx.stay(0, 1), page: '0' }, 'page');
  });

  it('rejects unknown parameters, destinations and filter slugs', async () => {
    await expectError({ ...ctx.stay(0, 1), colour: 'blue' }, 'colour');
    await expectError({ ...ctx.stay(0, 1), destination: 'atlantis' }, 'destination');
    await expectError({ ...ctx.stay(0, 1), amenities: 'helipad' }, 'amenities');
  });

  it('rejects distance sorting without a reference point', async () => {
    await expectError({ ...ctx.stay(0, 1), sort: 'distance_asc' }, 'sort');
  });

  it('rejects coordinates outside South Africa', async () => {
    await expectError({ ...ctx.stay(0, 1), lat: '51.5', lng: '-0.12' }, 'lat');
  });
});
