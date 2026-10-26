import type { ApiErrorBody, OffersResponse, PropertyDetail, SearchResponse } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { getJson, useTestApp } from './helpers';

const ctx = useTestApp();
const SLUG = 'fynbos-ridge-guesthouse-knysna';

describe('GET /api/properties/:slug', () => {
  it('returns full property details', async () => {
    const { status, body } = await getJson<PropertyDetail>(ctx.app, `/api/properties/${SLUG}`);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      slug: SLUG,
      name: 'Fynbos Ridge Guesthouse',
      propertyType: { slug: 'guesthouse' },
      destination: { slug: 'knysna', province: 'Western Cape' },
      dataSource: { code: 'synthetic-demo', kind: 'synthetic' },
      isDemo: true,
    });
    expect(body.images.length).toBeGreaterThan(0);
    expect(body.images.every((i) => i.alt.length > 0)).toBe(true);
    expect(body.roomTypes.length).toBeGreaterThan(0);
    expect(body.providers.length).toBeGreaterThan(0);
    expect(body.checkIn.from).toMatch(/^\d{2}:\d{2}$/);
  });

  it('returns 404 for an unknown property and 400 for a malformed slug', async () => {
    const missing = await getJson<ApiErrorBody>(ctx.app, '/api/properties/no-such-place');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    const bad = await getJson<ApiErrorBody>(ctx.app, '/api/properties/Bad%20Slug');
    expect(bad.status).toBe(400);
  });
});

describe('GET /api/properties/:slug/offers', () => {
  it('groups eligible offers by room type with consistent badges', async () => {
    const { status, body } = await getJson<OffersResponse>(
      ctx.app,
      `/api/properties/${SLUG}/offers`,
      ctx.stay(10, 2),
    );
    expect(status).toBe(200);
    const offers = body.groups.flatMap((g) => g.offers);
    expect(offers.length).toBe(body.summary.eligibleCount);
    if (offers.length === 0) return; // fully booked on these dates is a valid (if unlucky) outcome

    const cheapest = Math.min(...offers.map((o) => o.price.totalCents));
    const cheapestOffer = offers.find((o) => o.id === body.summary.cheapestOfferId)!;
    expect(cheapestOffer.price.totalCents).toBe(cheapest);
    expect(cheapestOffer.badges).toContain('cheapest');
    expect(offers.filter((o) => o.badges.includes('cheapest'))).toHaveLength(1);
    expect(offers.filter((o) => o.badges.includes('recommended'))).toHaveLength(1);
    expect(body.summary.recommendationReason).toBeTruthy();

    for (const group of body.groups) {
      const totals = group.offers.map((o) => o.price.totalCents);
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
    }
  });

  it('breaks every price down consistently and labels it simulated', async () => {
    const { body } = await getJson<OffersResponse>(
      ctx.app,
      `/api/properties/${SLUG}/offers`,
      ctx.stay(20, 3),
    );
    for (const offer of body.groups.flatMap((g) => g.offers)) {
      const p = offer.price;
      const expectedTotal = p.roomSubtotalCents + p.feesCents + (p.taxIncluded ? 0 : p.taxCents);
      expect(p.totalCents).toBe(expectedTotal);
      expect(p.nights).toBe(3);
      expect(offer.dataStatus).toBe('simulated');
      expect(new Date(offer.lastCheckedAt).toString()).not.toBe('Invalid Date');
      if (p.feesCents > 0) expect(p.feeLabel).toBeTruthy();
    }
  });

  it('explains why rooms are unavailable (too small for the group)', async () => {
    const { body } = await getJson<OffersResponse>(
      ctx.app,
      `/api/properties/${SLUG}/offers`,
      ctx.stay(10, 2, 16),
    );
    expect(body.summary.eligibleCount).toBe(0);
    expect(body.groups).toEqual([]);
    expect(body.unavailable.length).toBeGreaterThan(0);
    expect(body.unavailable.every((u) => u.reason === 'too_small')).toBe(true);
  });

  it('reports rooms blocked for the dates', async () => {
    const { rows } = await ctx.pool.query<{ slug: string; start: string; nights: number }>(
      `SELECT p.slug, lower(b.blocked)::text AS start, (upper(b.blocked) - lower(b.blocked)) AS nights
       FROM room_availability_blocks b JOIN room_types rt ON rt.id = b.room_type_id
       JOIN properties p ON p.id = rt.property_id
       WHERE lower(b.blocked) > current_date + 1
         AND EXISTS (SELECT 1 FROM offers o WHERE o.room_type_id = rt.id AND o.status = 'active')
       ORDER BY b.id LIMIT 1`,
    );
    const block = rows[0]!;
    const checkOut = new Date(Date.parse(`${block.start}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { body } = await getJson<OffersResponse>(
      ctx.app,
      `/api/properties/${block.slug}/offers`,
      {
        checkIn: block.start,
        checkOut,
        guests: '1',
      },
    );
    expect(body.unavailable.map((u) => u.reason)).toContain('booked_for_dates');
  });

  it('agrees with the search result for the same stay', async () => {
    const stay = ctx.stay(5, 2);
    const search = await getJson<SearchResponse>(ctx.app, '/api/search', {
      ...stay,
      destination: 'knysna',
    });
    for (const item of search.body.items) {
      const { body } = await getJson<OffersResponse>(
        ctx.app,
        `/api/properties/${item.slug}/offers`,
        stay,
      );
      const cheapest = body.groups
        .flatMap((g) => g.offers)
        .find((o) => o.id === body.summary.cheapestOfferId);
      expect(cheapest?.price.totalCents).toBe(item.bestOffer.totalCents);
      expect(body.summary.eligibleCount).toBe(item.offerCount);
    }
  });

  it('validates the stay', async () => {
    const { status, body } = await getJson<ApiErrorBody>(
      ctx.app,
      `/api/properties/${SLUG}/offers`,
      {
        ...ctx.stay(0, 1),
        checkOut: ctx.today,
      },
    );
    expect(status).toBe(400);
    expect(body.error.issues?.[0]?.path).toBe('checkOut');
    const missing = await getJson<ApiErrorBody>(
      ctx.app,
      '/api/properties/no-such-place/offers',
      ctx.stay(0, 1),
    );
    expect(missing.status).toBe(404);
  });
});
